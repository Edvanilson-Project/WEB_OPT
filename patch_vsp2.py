import os
path = '/home/edvanilson/WEB_OPT/optimizer/src/algorithms/vsp/greedy.py'
with open(path, 'r') as f:
    text = f.read()

# Fix the user requirement patch you requested: "intervalo minimo para veiculo 12 min e mmaximo de 09 horas e para tripulante mimimo de 12 e maximo de 1hora e 40 minutos"
# The gap max logic in `greedy.py`:
new_text = text.replace('split_shift_max_gap = int(self._p("split_shift_max_gap_minutes", 720))', 'split_shift_max_gap = 540')
# Min layover logic was replaced by something else, let's restore it
new_text = new_text.replace('''
        if (a.destination_id % 1000) == 1:
            return max(12, deadhead_needed)
''', '')
with open(path, 'w') as f:
    f.write(new_text)

os.system('cd /home/edvanilson/WEB_OPT/backend && npm run build')
os.system('fuser -k 3001/tcp || true; npm run start:dev --prefix /home/edvanilson/WEB_OPT/backend &')
os.system('fuser -k 8000/tcp || true; cd /home/edvanilson/WEB_OPT/optimizer && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 &')
