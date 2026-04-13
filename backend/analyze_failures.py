import asyncio
from sqlalchemy import create_engine, text
import json
import os

# Tenta pegar a string de conexão do .env se existir, ou chuta o padrão do docker/local
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")

engine = create_engine(DB_URL)

def analyze_failures():
    query = text("""
        SELECT id, status, "errorMessage", result_summary, started_at, finished_at
        FROM optimization_runs
        WHERE status IN ('failed', 'cancelled')
        ORDER BY createdAt DESC
        LIMIT 5;
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query)
        rows = result.fetchall()
        
        print(f"Encontradas {len(rows)} falhas recentes:\n")
        for row in rows:
            print(f"--- RUN #{row[0]} ({row[1]}) ---")
            print(f"Início: {row[4]} | Fim: {row[5]}")
            print(f"Erro: {row[2]}")
            # print(f"Sumário: {json.dumps(row[3], indent=2)}")
            print("-" * 30)

if __name__ == "__main__":
    try:
        analyze_failures()
    except Exception as e:
        print(f"Erro ao conectar no banco: {e}")
