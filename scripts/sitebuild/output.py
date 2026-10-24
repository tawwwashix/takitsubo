"""Write changed text only, preserving the existing platform encoding/newlines."""


def write_output(path, text, *, encoding="utf-8"):
    """Return whether content changed; unchanged pages keep their file timestamps."""
    try:
        if path.read_text(encoding=encoding) == text:
            return False
    except FileNotFoundError:
        pass
    path.write_text(text, encoding=encoding)
    return True
