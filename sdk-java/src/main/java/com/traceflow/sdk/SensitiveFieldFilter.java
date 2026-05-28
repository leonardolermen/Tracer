package com.traceflow.sdk;

import java.util.*;

/**
 * Sanitizes objects before logging — redacts sensitive fields
 * and flattens nested structures into String->String maps.
 */
public final class SensitiveFieldFilter {

    private static final Set<String> SENSITIVE = Set.of(
        "password", "senha", "token", "secret", "authorization",
        "cvv", "card_number", "cardnumber", "cpf", "ssn",
        "access_token", "refresh_token", "private_key", "api_key",
        "pin", "credential", "passphrase"
    );

    private SensitiveFieldFilter() {}

    /** Sanitizes a Map<String, Object> into a flat Map<String, String>. */
    public static Map<String, String> sanitize(Map<String, Object> input) {
        if (input == null) return Collections.emptyMap();
        Map<String, String> result = new LinkedHashMap<>();
        flattenMap("", input, result, 0);
        return result;
    }

    /** Uses reflection to extract and sanitize all fields from any object. */
    public static Map<String, String> fromObject(Object obj) {
        if (obj == null) return Collections.emptyMap();
        Map<String, String> result = new LinkedHashMap<>();
        try {
            Class<?> clazz = obj.getClass();
            while (clazz != null && clazz != Object.class) {
                for (java.lang.reflect.Field field : clazz.getDeclaredFields()) {
                    // skip synthetic / static fields
                    if (java.lang.reflect.Modifier.isStatic(field.getModifiers())) continue;
                    field.setAccessible(true);
                    String name = field.getName();
                    if (isSensitive(name)) {
                        result.put(name, "[REDACTED]");
                    } else {
                        Object val = field.get(obj);
                        if (val != null) {
                            String str = val.toString();
                            result.put(name, str.length() > 500 ? str.substring(0, 497) + "..." : str);
                        }
                    }
                }
                clazz = clazz.getSuperclass();
            }
        } catch (Exception ignored) {}
        return result;
    }

    public static boolean isSensitive(String key) {
        if (key == null) return false;
        String lower = key.toLowerCase();
        return SENSITIVE.stream().anyMatch(lower::contains);
    }

    @SuppressWarnings("unchecked")
    private static void flattenMap(String prefix, Map<String, Object> map, Map<String, String> result, int depth) {
        if (depth > 4 || map == null) return;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
            Object value = entry.getValue();
            if (isSensitive(entry.getKey())) {
                result.put(key, "[REDACTED]");
            } else if (value instanceof Map) {
                flattenMap(key, (Map<String, Object>) value, result, depth + 1);
            } else if (value != null) {
                String str = value.toString();
                result.put(key, str.length() > 500 ? str.substring(0, 497) + "..." : str);
            }
        }
    }
}
