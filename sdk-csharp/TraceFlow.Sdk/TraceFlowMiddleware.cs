using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace TraceFlow.Sdk
{
    public class TraceFlowMiddleware
    {
        private readonly RequestDelegate _next;
        private static readonly HttpClient _httpClient = new HttpClient();
        private readonly string _collectorUrl;

        // Regex to redact sensitive fields.
        // Matches basic JSON ("password":"...") and Form/Query (password=...)
        private static readonly Regex SensitiveRegex = new Regex(
            @"(?i)(password|token|cvv)(\s*[""']?\s*[:=]\s*[""']?)[^""'&,\s]+([""']?)",
            RegexOptions.Compiled);

        public TraceFlowMiddleware(RequestDelegate next)
        {
            _next = next;
            _collectorUrl = Environment.GetEnvironmentVariable("TF_COLLECTOR_URL") 
                            ?? "http://localhost:4318/v1/traces";
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var spanId = Guid.NewGuid().ToString("N");
            var traceId = context.TraceIdentifier;
            var startTime = DateTime.UtcNow;

            // 1. Read Request Body
            context.Request.EnableBuffering();
            var requestBody = await ReadStreamAsync(context.Request.Body);
            if (context.Request.Body.CanSeek)
            {
                context.Request.Body.Position = 0;
            }

            requestBody = RedactAndTruncate(requestBody);

            // 2. Wrap Response Body
            var originalResponseBodyStream = context.Response.Body;
            using var responseBodyStream = new MemoryStream();
            context.Response.Body = responseBodyStream;

            try
            {
                await _next(context);
            }
            finally
            {
                // 3. Read Response Body
                responseBodyStream.Position = 0;
                var responseBody = await ReadStreamAsync(responseBodyStream);

                // Copy to the original response stream
                responseBodyStream.Position = 0;
                await responseBodyStream.CopyToAsync(originalResponseBodyStream);
                context.Response.Body = originalResponseBodyStream;

                responseBody = RedactAndTruncate(responseBody);
                var endTime = DateTime.UtcNow;

                // 4. Generate Span and Dispatch
                _ = DispatchSpanAsync(traceId, spanId, context, requestBody, responseBody, startTime, endTime);
            }
        }

        private async Task<string> ReadStreamAsync(Stream stream)
        {
            if (stream == null || !stream.CanRead) return string.Empty;

            using var reader = new StreamReader(
                stream,
                Encoding.UTF8,
                detectEncodingFromByteOrderMarks: false,
                bufferSize: 1024,
                leaveOpen: true);

            return await reader.ReadToEndAsync();
        }

        private string RedactAndTruncate(string body)
        {
            if (string.IsNullOrEmpty(body)) return body;

            // Truncate to 2KB
            if (body.Length > 2048)
            {
                body = body.Substring(0, 2048) + "...[TRUNCATED]";
            }

            // Redact sensitive fields
            body = SensitiveRegex.Replace(body, "$1$2[REDACTED]$3");

            return body;
        }

        private async Task DispatchSpanAsync(
            string traceId, 
            string spanId, 
            HttpContext context, 
            string requestBody, 
            string responseBody, 
            DateTime startTime, 
            DateTime endTime)
        {
            try
            {
                var payload = new
                {
                    traceId = traceId,
                    spanId = spanId,
                    name = $"{context.Request.Method} {context.Request.Path}",
                    startTime = startTime.ToString("O"),
                    endTime = endTime.ToString("O"),
                    attributes = new
                    {
                        httpMethod = context.Request.Method,
                        httpUrl = context.Request.Path.ToString(),
                        httpStatusCode = context.Response.StatusCode
                    },
                    events = new[]
                    {
                        new
                        {
                            name = "http.request",
                            time = startTime.ToString("O"),
                            attributes = new { body = requestBody }
                        },
                        new
                        {
                            name = "http.response",
                            time = endTime.ToString("O"),
                            attributes = new { body = responseBody }
                        }
                    }
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Fire and forget
                await _httpClient.PostAsync(_collectorUrl, content);
            }
            catch
            {
                // Ignore exceptions on fire-and-forget logging
            }
        }
    }

    public static class TraceFlowMiddlewareExtensions
    {
        public static IApplicationBuilder UseTraceFlow(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TraceFlowMiddleware>();
        }
    }
}
