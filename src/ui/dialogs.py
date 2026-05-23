import customtkinter as ctk

def show_error(title: str, message: str, parent=None):
    """Shows a simple error dialog."""
    dialog = ctk.CTkToplevel(parent)
    dialog.title(title)
    dialog.geometry("400x150")
    dialog.attributes('-topmost', 'true')
    
    # Center the dialog
    if parent:
        dialog.geometry(f"+{parent.winfo_rootx() + 50}+{parent.winfo_rooty() + 50}")
    
    label = ctk.CTkLabel(dialog, text=message, wraplength=350)
    label.pack(pady=20, padx=20)
    
    btn = ctk.CTkButton(dialog, text="OK", command=dialog.destroy)
    btn.pack(pady=10)
    
    dialog.grab_set()

def show_info(title: str, message: str, parent=None):
    """Shows a simple info dialog."""
    show_error(title, message, parent)

def ask_yes_no(title: str, message: str, parent=None) -> bool:
    """Shows a Yes/No dialog and returns True if Yes, False if No."""
    dialog = ctk.CTkToplevel(parent)
    dialog.title(title)
    dialog.geometry("400x150")
    dialog.attributes('-topmost', 'true')
    
    if parent:
        dialog.geometry(f"+{parent.winfo_rootx() + 50}+{parent.winfo_rooty() + 50}")
        
    result = ctk.BooleanVar(value=False)
    
    label = ctk.CTkLabel(dialog, text=message, wraplength=350)
    label.pack(pady=20, padx=20)
    
    btn_frame = ctk.CTkFrame(dialog, fg_color="transparent")
    btn_frame.pack(pady=10)
    
    def on_yes():
        result.set(True)
        dialog.destroy()
        
    def on_no():
        result.set(False)
        dialog.destroy()
        
    btn_yes = ctk.CTkButton(btn_frame, text="Sí", width=100, command=on_yes)
    btn_yes.pack(side="left", padx=10)
    
    btn_no = ctk.CTkButton(btn_frame, text="No", width=100, fg_color="gray", hover_color="darkgray", command=on_no)
    btn_no.pack(side="left", padx=10)
    
    dialog.grab_set()
    dialog.wait_window()
    return result.get()

