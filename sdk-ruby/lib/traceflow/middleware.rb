require 'json'
require 'net/http'
require 'uri'
require 'rack'
require 'time'

module TraceFlow
  class Middleware
    MAX_BODY_SIZE = 2048

    def initialize(app, options = {})
      @app = app
      @collector_url = ENV['TF_COLLECTOR_URL'] || options[:collector_url]
    end

    def call(env)
      request = Rack::Request.new(env)
      
      # Capture request body
      req_body = ""
      if request.body
        request.body.rewind if request.body.respond_to?(:rewind)
        req_body = request.body.read(MAX_BODY_SIZE) || ""
        request.body.rewind if request.body.respond_to?(:rewind)
      end

      # Truncate request body
      req_body = req_body[0, MAX_BODY_SIZE] || ""

      start_time = Time.now.utc

      # Process the request
      status, headers, response = @app.call(env)

      end_time = Time.now.utc

      # Capture response body
      res_body = ""
      new_response = []
      if response.respond_to?(:each)
        response.each do |chunk|
          new_response << chunk
          res_body << chunk.to_s if res_body.length < MAX_BODY_SIZE
        end
        response.close if response.respond_to?(:close)
        response = new_response
      end

      # Truncate response body
      res_body = res_body[0, MAX_BODY_SIZE] || ""
      
      # Redact sensitive info
      redacted_req_body = redact(req_body)
      redacted_res_body = redact(res_body)

      # Dispatch span
      dispatch_span(request, status, redacted_req_body, redacted_res_body, start_time, end_time)

      [status, headers, response]
    end

    private

    def redact(text)
      return "" if text.nil? || text.empty?
      # Redact fields like password, token, cvv
      text.gsub(/([\"\']?(?:password|token|cvv)[\"\']?\s*(?:[:=]|=>)\s*)([\"\']?[^&\"',}\s]+[\"\']?)/i, '\1"[REDACTED]"')
    end

    def dispatch_span(request, status, req_body, res_body, start_time, end_time)
      return unless @collector_url && !@collector_url.empty?
      
      span = {
        name: "#{request.request_method} #{request.path_info}",
        start_time: start_time.iso8601(3),
        end_time: end_time.iso8601(3),
        attributes: {
          "http.method" => request.request_method,
          "http.url" => request.url,
          "http.status_code" => status
        },
        logs: [
          {
            timestamp: start_time.iso8601(3),
            name: "http.request",
            attributes: {
              "http.request.body" => req_body
            }
          },
          {
            timestamp: end_time.iso8601(3),
            name: "http.response",
            attributes: {
              "http.response.body" => res_body
            }
          }
        ]
      }

      Thread.new do
        begin
          uri = URI(@collector_url)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = (uri.scheme == 'https')
          req = Net::HTTP::Post.new(uri.path.empty? ? "/" : uri.path, 'Content-Type' => 'application/json')
          req.body = JSON.generate(span)
          http.request(req)
        rescue => e
          # Silently ignore errors in background thread for SDK
        end
      end
    end
  end
end
