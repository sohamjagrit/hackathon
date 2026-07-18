"""Thin wrappers around the Vocal Bridge CLI for Act 2 outbound calls."""

from __future__ import annotations

import asyncio
import os
import shutil
from typing import Optional


def _vb_bin() -> str:
    configured = os.getenv("VB_CLI_PATH", "").strip()
    if configured:
        return configured
    found = shutil.which("vb")
    if found:
        return found
    home = os.path.expanduser("~/.local/bin/vb")
    if os.path.isfile(home):
        return home
    return "vb"


def _env() -> dict:
    env = os.environ.copy()
    # vb auth often reads VOCAL_BRIDGE_API_KEY from the environment
    return env


async def vb_agent_use(agent_id: str) -> None:
    proc = await asyncio.create_subprocess_exec(
        _vb_bin(),
        "agent",
        "use",
        agent_id,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=_env(),
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"vb agent use failed ({proc.returncode}): "
            f"{(stderr or stdout).decode(errors='replace')}"
        )


async def vb_call(
    phone: str,
    *,
    agent_id: Optional[str] = None,
    name: Optional[str] = None,
    timeout_s: float = 300,
) -> dict:
    """Select optional agent, place outbound call, wait until it ends."""
    if agent_id:
        await vb_agent_use(agent_id)

    args = [_vb_bin(), "call", phone, "--json"]
    if name:
        args.extend(["--name", name])

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=_env(),
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise TimeoutError(f"vb call to {phone} exceeded {timeout_s}s")

    out = (stdout or b"").decode(errors="replace").strip()
    err = (stderr or b"").decode(errors="replace").strip()
    ok = proc.returncode == 0
    return {
        "ok": ok,
        "returncode": proc.returncode,
        "stdout": out,
        "stderr": err,
        "phone": phone,
    }
