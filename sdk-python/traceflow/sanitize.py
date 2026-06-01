SENSITIVE_KEYS = {"password", "senha", "token", "secret", "authorization", "cvv", "card_number", "cpf", "ssn"}

def sanitize(obj, max_depth=3):
    if not obj or not isinstance(obj, dict) or max_depth == 0:
        return {}
    
    result = {}
    for k, v in obj.items():
        k_str = str(k).lower()
        if k_str in SENSITIVE_KEYS:
            result[k] = "[REDACTED]"
        elif isinstance(v, dict):
            nested = sanitize(v, max_depth - 1)
            for nk, nv in nested.items():
                result[f"{k}.{nk}"] = nv
        elif isinstance(v, list):
            result[k] = f"[List size={len(v)}]"
        else:
            result[k] = str(v)
    return result
