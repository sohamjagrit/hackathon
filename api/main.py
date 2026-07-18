from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import context, events, paypal, recovery, tools, voice

app = FastAPI(title="Trip Agent API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router)
app.include_router(tools.router)
app.include_router(events.router)
app.include_router(context.router)
app.include_router(recovery.router)
app.include_router(paypal.router)


@app.get("/health")
async def health():
    return {"ok": True}
