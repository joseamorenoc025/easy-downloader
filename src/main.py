import sys
import os

# Añadir el directorio raíz del proyecto al path de Python para que reconozca "src"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.ui.main_window import MainWindow

def main():
    try:
        app = MainWindow()
        app.mainloop()
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
