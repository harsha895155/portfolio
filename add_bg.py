import re
import random

html_path = r'c:\Users\harsh\.gemini\antigravity\scratch\Portfolio\index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

patterns = [1, 2, 3, 4, 5]

def add_bg_html(match):
    tag = match.group(0)
    # Check if already has has-bg
    if 'has-bg' in tag:
        return tag
        
    new_tag = tag.replace('class="', 'class="has-bg ')
    
    # insert bg divs right after the tag opens
    bg_html = f'\n      <div class="bg-image bg-pattern-{random.choice(patterns)}"></div>\n      <div class="bg-overlay"></div>'
    return new_tag + bg_html

content = re.sub(r'<a class="cert-card[^>]*>', add_bg_html, content)
content = re.sub(r'<div class="achv-item[^>]*>', add_bg_html, content)
content = re.sub(r'<div class="proj-card[^>]*>', add_bg_html, content)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
