"""Compare real PE icon resources with the canonical BillZen ICO; no extra packages."""
import argparse
import hashlib
import json
from pathlib import Path
import struct


def frames_from_ico(path):
    data = Path(path).read_bytes()
    reserved, kind, count = struct.unpack_from('<HHH', data)
    if reserved != 0 or kind != 1 or not count:
        raise ValueError('Invalid canonical ICO')
    frames = {}
    for i in range(count):
        entry = 6 + 16 * i
        width, height = data[entry:entry + 2]
        length, offset = struct.unpack_from('<II', data, entry + 8)
        frames[(width or 256, height or 256)] = data[offset:offset + length]
    return frames


def resources_from_pe(path):
    data = Path(path).read_bytes()
    if data[:2] != b'MZ':
        raise ValueError('Not a Windows executable')
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    if data[pe:pe + 4] != b'PE\0\0':
        raise ValueError('Missing PE signature')
    section_count = struct.unpack_from('<H', data, pe + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    magic = struct.unpack_from('<H', data, optional)[0]
    if magic not in (0x10b, 0x20b):
        raise ValueError('Unsupported PE optional header')
    directory = optional + (96 if magic == 0x10b else 112)
    resource_rva = struct.unpack_from('<I', data, directory + 16)[0]
    sections = []
    for i in range(section_count):
        entry = optional + optional_size + 40 * i
        virtual_size, address, raw_size, raw_offset = struct.unpack_from('<IIII', data, entry + 8)
        sections.append((address, max(virtual_size, raw_size), raw_offset))

    def offset(rva):
        for address, size, raw in sections:
            if address <= rva < address + size:
                return raw + rva - address
        raise ValueError('Resource RVA outside sections')

    base = offset(resource_rva)
    resources = {}

    def walk(relative, trail):
        if len(trail) > 3:
            raise ValueError('Unexpected resource nesting')
        directory_offset = base + relative
        named, numbered = struct.unpack_from('<HH', data, directory_offset + 12)
        for i in range(named + numbered):
            name, target = struct.unpack_from('<II', data, directory_offset + 16 + i * 8)
            key = name if not name & 0x80000000 else 'named'
            if target & 0x80000000:
                walk(target & 0x7fffffff, trail + (key,))
            else:
                rva, size = struct.unpack_from('<II', data, base + target)
                start = offset(rva)
                resources[trail + (key,)] = data[start:start + size]
    walk(0, ())
    return resources


def verify_icons(executable, expected):
    resources = resources_from_pe(executable)
    matched = []
    for key, group in resources.items():
        if key[0] != 14:
            continue
        count = struct.unpack_from('<H', group, 4)[0]
        seen = set()
        for i in range(count):
            entry = 6 + 14 * i
            width, height = group[entry:entry + 2]
            dimensions = (width or 256, height or 256)
            icon_id = struct.unpack_from('<H', group, entry + 12)[0]
            image = resources.get((3, icon_id, key[-1]))
            if image == expected.get(dimensions) and image:
                seen.add(dimensions)
        if set(expected).issubset(seen):
            matched.append(key[1])
    if not matched:
        raise AssertionError(f'{executable}: no icon group matches all canonical BillZen frames')
    return {'file': Path(executable).name, 'sha256': hashlib.sha256(Path(executable).read_bytes()).hexdigest(), 'matchingGroups': matched, 'frames': [list(size) for size in sorted(expected)], 'passed': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executables', nargs='+')
    parser.add_argument('--icon', default='src-tauri/icons/icon.ico')
    parser.add_argument('--output')
    args = parser.parse_args()
    expected = frames_from_ico(args.icon)
    report = [verify_icons(path, expected) for path in args.executables]
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2) + '\n')
    print(f'PASS: canonical BillZen icon frames verified in {len(report)} Windows executables')
