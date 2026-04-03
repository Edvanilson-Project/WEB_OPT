import re

fname = "/home/edvanilson/WEB_OPT/optimizer/src/algorithms/joint_opt.py"
with open(fname, "r") as f:
    text = f.read()

# remove empty if
text = re.sub(r'if b2\.trips:\s*changed = True', r'changed = True', text)

with open(fname, "w") as f:
    f.write(text)

