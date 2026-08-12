import difflib

file_active = r"Last WP Plugin\events-api\events-api.php"
file_working = r"Working Plugin\events-api (2).php"

def get_function_lines(filepath, func_name):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    start_idx = -1
    for i, line in enumerate(lines):
        if f"function {func_name}" in line:
            start_idx = i
            break
            
    if start_idx == -1:
        return None
        
    # Simple brace matcher to find end of function
    brace_count = 0
    end_idx = -1
    started = False
    
    for i in range(start_idx, len(lines)):
        line = lines[i]
        if '{' in line:
            brace_count += line.count('{')
            started = True
        if '}' in line:
            brace_count -= line.count('}')
            
        if started and brace_count == 0:
            end_idx = i
            break
            
    if end_idx == -1:
        return lines[start_idx:start_idx+100] # fallback
        
    return lines[start_idx:end_idx+1]

func_active = get_function_lines(file_active, "app_event_booking")
func_working = get_function_lines(file_working, "app_event_booking")

if func_active and func_working:
    diff = difflib.unified_diff(
        func_working, 
        func_active, 
        fromfile='working app_event_booking', 
        tofile='active app_event_booking',
        n=3
    )
    print("".join(diff))
else:
    print(f"Error: Function not found. Active: {bool(func_active)}, Working: {bool(func_working)}")
