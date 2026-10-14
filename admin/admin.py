"""Локальная админка портфолио. Запуск: admin/start.bat (или python admin/admin.py)."""
import io, json, mimetypes, os, re, secrets, shutil, subprocess, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote, quote
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'data', 'galleries.json')   # публичный список: только открытые галереи
GDIR = os.path.join(ROOT, 'data', 'g')                  # по файлу на каждую галерею (имя = случайный id)
PORT = 8765
HEX = re.compile(r'^[0-9a-f]+$')


def rid(n):
    """Случайное имя: по нему нельзя понять, что внутри."""
    return secrets.token_hex(n)


def load():
    gs = []
    if os.path.isdir(GDIR):
        for fn in os.listdir(GDIR):
            if fn.endswith('.json'):
                with open(os.path.join(GDIR, fn), encoding='utf8') as f:
                    gs.append(json.load(f))
    gs.sort(key=lambda g: g.get('created', ''), reverse=True)
    return {'galleries': gs}


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def save(d):
    keep = set()
    for g in d['galleries']:
        write_json(os.path.join(GDIR, g['slug'] + '.json'), g)
        keep.add(g['slug'] + '.json')
    for fn in os.listdir(GDIR):
        if fn.endswith('.json') and fn not in keep:
            os.remove(os.path.join(GDIR, fn))
    pub = []
    for g in d['galleries']:
        n = sum(len(f['photos']) for f in g['folders'])
        if not g.get('hidden') and n:
            pub.append({'slug': g['slug'], 'title': g['title'], 'date': g.get('date', ''),
                        'cover': g.get('cover', ''), 'focus': g.get('focus', ''), 'count': n})
    write_json(INDEX, {'galleries': pub})


def migrate():
    """Старый формат (всё в galleries.json, понятные имена) -> случайные имена и отдельные файлы."""
    try:
        with open(INDEX, encoding='utf8') as f:
            old = json.load(f)
    except Exception:
        return
    if not any('folders' in g for g in old.get('galleries', [])):
        return
    gs = []
    for g in old['galleries']:
        if 'folders' not in g:
            continue
        nid = rid(8)
        src = os.path.join(ROOT, 'photos', g['slug'])
        dst = os.path.join(ROOT, 'photos', nid)
        if os.path.isdir(src):
            os.replace(src, dst)
        cover = g.get('cover', '')
        for f in g['folders']:
            nf = rid(4)
            if os.path.isdir(os.path.join(dst, f['id'])):
                os.replace(os.path.join(dst, f['id']), os.path.join(dst, nf))
            names = []
            for p in f['photos']:
                np_ = rid(6) + os.path.splitext(p)[1].lower()
                for k in ('full', 'thumb'):
                    a_ = os.path.join(dst, nf, k, p)
                    if os.path.isfile(a_):
                        os.replace(a_, os.path.join(dst, nf, k, np_))
                if cover == f"photos/{g['slug']}/{f['id']}/thumb/{p}":
                    cover = f"photos/{nid}/{nf}/thumb/{np_}"
                names.append(np_)
            f['id'], f['photos'] = nf, names
        g['slug'], g['cover'] = nid, cover
        g.setdefault('created', g.get('date', '') + 'T00:00:00')
        gs.append(g)
    save({'galleries': gs})
    print(f'Галереи переведены на случайные имена: {len(gs)}')


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
        d['galleries'].insert(0, {'slug': rid(8), 'title': b['title'], 'date': b.get('date', ''),
                                  'hidden': bool(b.get('hidden')), 'cover': '',
                                  'created': time.strftime('%Y-%m-%dT%H:%M:%S'),
                                  'folders': [{'id': rid(4), 'name': 'Фото', 'photos': []}]})
    else:
        g, f = find(d, b.get('slug'), b.get('fid'))
        if name == 'update':
            for k in ('title', 'date', 'hidden', 'cover', 'focus'):
                if k in b:
                    g[k] = b[k]
        elif name == 'delete_gallery':
            shutil.rmtree(os.path.join(ROOT, 'photos', g['slug']), ignore_errors=True)
            d['galleries'].remove(g)
        elif name == 'folder':
            g['folders'].append({'id': rid(4), 'name': b['name'], 'photos': []})
        elif name == 'rename_folder':
            f['name'] = b['name']
        elif name == 'delete_folder':
            shutil.rmtree(os.path.join(ROOT, 'photos', g['slug'], f['id']), ignore_errors=True)
            g['folders'].remove(f)
        elif name == 'delete_photo':
            if not HEX.match(os.path.splitext(b['file'])[0]):
                raise ValueError('Неверное имя файла')
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


# ---------- Фото «Обо мне» и слайдер лучших кадров ----------
SITE = os.path.join(ROOT, 'data', 'site.json')
SDIR = os.path.join(ROOT, 'photos', 'site')


def load_site():
    try:
        with open(SITE, encoding='utf8') as f:
            d = json.load(f)
    except Exception:
        d = {}
    d.setdefault('about', None)
    d.setdefault('slider', [])
    return d


def rm_site_file(name):
    for k in ('web', 'thumb'):
        try:
            os.remove(os.path.join(SDIR, k, name))
        except OSError:
            pass


def site_upload(q, body):
    kind = q['kind'][0]
    if kind not in ('about', 'slider'):
        raise ValueError('Неизвестный раздел')
    ext = os.path.splitext(q['name'][0])[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise ValueError('Поддерживаются JPG, PNG, WEBP')
    name = rid(6) + '.jpg'
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(body))).convert('RGB')
    for k, size, qual in (('web', 2200, 86), ('thumb', 600, 80)):
        os.makedirs(os.path.join(SDIR, k), exist_ok=True)
        c = im.copy()
        c.thumbnail((size, size))
        c.save(os.path.join(SDIR, k, name), quality=qual, optimize=True, progressive=True)
    d = load_site()
    if kind == 'about':
        if d['about']:
            rm_site_file(d['about']['file'])
        d['about'] = {'file': name, 'focus': '50% 35%'}
    else:
        d['slider'].append({'file': name})
    write_json(SITE, d)
    return d


def site_act(b):
    d = load_site()
    a = b.get('action')
    if a == 'about_delete' and d['about']:
        rm_site_file(d['about']['file'])
        d['about'] = None
    elif a == 'about_focus' and d['about']:
        d['about']['focus'] = str(b['focus'])[:20]
    elif a == 'slider_delete':
        d['slider'] = [x for x in d['slider'] if x['file'] != b['file']]
        if HEX.match(os.path.splitext(b['file'])[0]):
            rm_site_file(b['file'])
    elif a == 'slider_order':
        by = {x['file']: x for x in d['slider']}
        d['slider'] = [by[f] for f in b['order'] if f in by] + [x for x in d['slider'] if x['file'] not in b['order']]
    elif a != 'get':
        raise ValueError('Неизвестное действие')
    if a != 'get':
        write_json(SITE, d)
    return d


def upload(q, body):
    d = load()
    g, f = find(d, q['slug'][0], q['fid'][0])
    stem, ext = os.path.splitext(q['name'][0])
    ext = ext.lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise ValueError('Поддерживаются JPG, PNG, WEBP: ' + stem + ext)
    name = rid(6) + ext
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
            if name == 'site_upload':
                r = site_upload(parse_qs(u.query), body)
            elif name == 'site':
                r = site_act(json.loads(body or b'{}'))
            elif name == 'upload':
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
    migrate()
    print(f'Админка: http://localhost:{PORT}  (остановить: Ctrl+C)')
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
