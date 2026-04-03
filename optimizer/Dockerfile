FROM python:3.11-slim

WORKDIR /app

# Dependências do sistema (CBC solver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    coinor-cbc coinor-libcbc-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
