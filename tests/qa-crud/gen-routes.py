#!/usr/bin/env python3
"""Regenerates routes.json (method, path, allowed roles, public?) from the Nest controllers. Run: python3 tests/qa-crud/gen-routes.py"""
import re, glob, json, os
root = os.path.join(os.path.dirname(__file__), '../../apps/api/src')
out = []
for f in sorted(glob.glob(root + '/**/*.controller.ts', recursive=True)):
    s = open(f).read()
    for part in re.split(r"(?=@Controller\()", s)[1:]:
        base = re.match(r"@Controller\(\s*'?([^')]*)'?", part).group(1)
        head, body = part.split('export class', 1)
        cls_guard = 'JwtAuthGuard' in head or 'DeviceTokenGuard' in head
        cls_roles = re.findall(r"@Roles\(([^)]*)\)", head)
        for m in re.finditer(r"((?:\s*@\w+\([^\n]*\)\n)*)\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)", body):
            pre = m.group(1)
            auth = cls_guard or 'JwtAuthGuard' in pre or 'DeviceTokenGuard' in pre
            roles = re.findall(r"@Roles\(([^)]*)\)", pre) or cls_roles
            r = [x.strip().replace('UserRole.', '') for x in roles[0].split(',')] if roles else []
            path = ('/' + base + '/' + (m.group(3) or '')).replace('//', '/').rstrip('/') or '/'
            out.append({'method': m.group(2).upper(), 'path': path, 'auth': auth, 'roles': r, 'file': os.path.relpath(f, root)})
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'routes.json'), 'w'), indent=1)
print(len(out), 'routes')
