"""Локальная админка портфолио. Запуск: admin/start.bat (или python admin/admin.py)."""
import io, json, mimetypes, os, re, secrets, shutil, subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote, quote
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'galleries.json')
PORT = 8765
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
              ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','c','ch','sh','sch','','y','','e','yu','ya']))


def slugify(s):
    s = ''.join(TR.get(c, c) for c in s.lower())
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'photo'


def load():
    try:
        with open(DATA, encoding='utf8') as f:
            return json.load(f)
    except Exception:
        return {'galleries': []}


def save(d):
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    with open(DATA, 'w', encoding='utf8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def find(d, slug, fid=None):
    g = next((x for x in d['galleries'] if x['slug'] == slug), None)
    if g is None:
        raise ValueError('Галерея не найдена')
    if fid is None:
        return g, None
    f = next((x for x in g['folders'] if x['id'] == fid), None)
    if f is None:
        raise ValueError('Папка не найдена')
    return g, f


def thumb(g, f, p):
    return f"photos/{g['slug']}/{f['id']}/thumb/{p}"


def fix_cover(g):
    all_ = [thumb(g, f, p) for f in g['folders'] for p in f['photos']]
    if g.get('cover') not in all_:
        g['cover'] = all_[0] if all_ else ''


def act(name, b):
    d = load()
    if name == 'gallery':
        slug = slugify(b['title']) + '-' + secrets.token_hex(3)
        d['galleries'].insert(0, {'slug': slug, 'title': b['title'], 'date': b.get('date', ''),
                                  'hidden': bool(b.get('hidden')), 'cover': '',
                                  'folders': [{'id': 'f1', 'name': 'Фото', 'photos': []}]})
    else:
        g, f = find(d, b.get('slug'), b.get('fid'))
        if name == 'update':
            for k in ('title', 'date', 'hidden', 'cover'):
                if k in b:
                    g[k] = b[k]
        elif name == 'delete_gallery':
            shutil.rmtree(os.path.join(ROOT, 'photos', g['slug']), ignore_errors=True)
            d['galleries'].remove(g)
        elif name == 'folder':
            g['folders'].append({'id': 'f' + secrets.token_hex(3), 'name': b['name'], 'photos': []})
        elif name == 'rename_folder':
            f['name'] = b['name']
        elif name == 'delete_folder':
            shutil.rmtree(os.path.join(ROOT, 'photos', g['slug'], f['id']), ignore_errors=True)
            g['folders'].remove(f)
        elif name == 'delete_photo':
            for k in ('full', 'thumb'):
                try:
                    os.remove(os.path.join(ROOT, 'photos', g['slug'], f['id'], k, b['file']))
                except OSError:
                    pass
            f['photos'].remove(b['file'])
        else:
            raise ValueError('Неизвестное действие')
        if name != 'delete_gallery':
            fix_cover(g)
    save(d)
    return d


def upload(q, body):
    d = load()
    g, f = find(d, q['slug'][0], q['fid'][0])
    stem, ext = os.path.splitext(q['name'][0])
    ext = ext.lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise ValueError('Поддерживаются JPG, PNG, WEBP: ' + stem + ext)
    name = slugify(stem)[:40] + '-' + secrets.token_hex(2) + ext
    base = os.path.join(ROOT, 'photos', g['slug'], f['id'])
    os.makedirs(os.path.join(base, 'full'), exist_ok=True)
    os.makedirs(os.path.join(base, 'thumb'), exist_ok=True)
    with open(os.path.join(base, 'full', name), 'wb') as out:
        out.write(body)  # оригинал сохраняем как есть
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(body))).convert('RGB')
    im.thumbnail((900, 900))
    im.save(os.path.join(base, 'thumb', name), quality=82)
    f['photos'].append(name)
    fix_cover(g)
    save(d)
    return {'file': name}


def publish():
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        return 'Папка ещё не связана с GitHub (см. README.md).'
    git = shutil.which('git')
    if git:  # если установлен обычный Git — публикуем сами
        def run(*a):
            r = subprocess.run((git,) + a, cwd=ROOT, capture_output=True, text=True, encoding='utf8', errors='replace')
            return r.returncode, (r.stdout + r.stderr).strip()
        run('add', '-A')
        run('commit', '-m', 'Обновление галерей')
        code, out = run('push')
        if code == 0:
            return 'Опубликовано! Сайт обновится примерно через минуту.'
    # иначе открываем GitHub Desktop на этой папке
    os.startfile('x-github-client://openLocalRepo/' + quote(ROOT.replace('\\', '/')))
    return ('Открылся GitHub Desktop.\n1) Внизу слева нажмите «Commit to main».\n'
            '2) Сверху нажмите «Push origin».\nСайт обновится примерно через минуту.')


class H(BaseHTTPRequestHandler):
    def reply(self, code, body, ct='application/json'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode('utf8')
        self.send_response(code)
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = unquote(urlparse(self.path).path)
        if p == '/':
            with open(os.path.join(ROOT, 'admin', 'index.html'), 'rb') as f:
                return self.reply(200, f.read(), 'text/html; charset=utf-8')
        if p == '/api/data':
            return self.reply(200, load())
        fp = os.path.normpath(os.path.join(ROOT, p.lstrip('/')))
        if p.startswith('/photos/') and fp.startswith(os.path.join(ROOT, 'photos')) and os.path.isfile(fp):
            with open(fp, 'rb') as f:
                return self.reply(200, f.read(), mimetypes.guess_type(fp)[0] or 'application/octet-stream')
        self.reply(404, {'error': 'not found'})

    def do_POST(self):
        origin = self.headers.get('Origin')
        if origin and origin not in (f'http://localhost:{PORT}', f'http://127.0.0.1:{PORT}'):
            return self.reply(403, {'error': 'forbidden'})
        u = urlparse(self.path)
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        try:
            name = u.path.rsplit('/', 1)[-1]
            if name == 'upload':
                r = upload(parse_qs(u.query), body)
            elif name == 'publish':
                r = {'log': publish()}
            else:
                r = act(name, json.loads(body or b'{}'))
            self.reply(200, r)
        except Exception as e:
            self.reply(400, {'error': str(e)})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    print(f'Админка: http://localhost:{PORT}  (остановить: Ctrl+C)')
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
