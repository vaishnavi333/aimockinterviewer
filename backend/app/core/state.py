# app/core/state.py
from .session import MemorySessionStore

# one global store for the whole app
store = MemorySessionStore()
