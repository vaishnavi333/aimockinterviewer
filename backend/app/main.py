from . import create_app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    # Use ONE of these depending on where you start the process:

    # If you run from REPO ROOT:
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

    # If you run from inside backend/ instead, comment the above and use:
    # uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
