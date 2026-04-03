fuser -k 8000/tcp >/dev/null 2>&1 || true; sleep 1; cd optimizer && nohup .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > optimizer_nohupFINAL.log 2>&1 &
