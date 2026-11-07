"""Prepare synthetic verification fixtures from the organiser's ZIP for local use."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
IMAGES = ['K02_gst_certificate.png', 'K02_udyam_certificate.png', 'K02_address_proof.png',
          'K02_signatory_id.png', 'K11_address_proof.png']

def member(archive, name):
    entries = [item for item in archive.infolist()
               if Path(item.filename).name == name and '__MACOSX' not in item.filename.split('/')]
    if len(entries) != 1 or entries[0].file_size > 16_000_000:
        raise ValueError('Expected one organiser file named ' + name)
    return archive.read(entries[0])

def prepare(archive):
    tables = [('gst', 'mock_gstin_registry.csv', 'gstin', 'trade_name'),
              ('udyam', 'mock_udyam_registry.csv', 'udyam_number', 'enterprise_name')]
    index = {}
    examples = {}
    for kind, filename, id_column, name_column in tables:
        rows = csv.DictReader(io.StringIO(member(archive, filename).decode('utf-8-sig')))
        index[kind] = {}
        for row in rows:
            ident = row[id_column].strip().upper()
            key = hashlib.sha256(ident.encode()).hexdigest()
            index[kind][key] = [row[name_column], row.get('status', 'Registered')]
            if row[name_column] == 'Harmony Dental Care':
                examples[kind] = ident
    if set(examples) != {'gst','udyam'}:
        raise ValueError('K02 clinic fixtures were not found in this pack.')
    images = {name: member(archive,name) for name in IMAGES}
    samples = HERE / 'samples'
    samples.mkdir(exist_ok=True)
    for name, data in images.items():
        (samples / name).write_bytes(data)
    (samples / 'test-identifiers.json').write_text(json.dumps(examples))
    (HERE / 'service' / 'registry.json').write_text(json.dumps(index,separators=(',',':')))
    print('Prepared the mock registry index and five fictional specimens for local use.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('case_zip', type=Path, help='Either the distributed outer ZIP or its YTL data ZIP')
    args = parser.parse_args()
    with ZipFile(args.case_zip) as outer:
        if any(Path(n).name == 'mock_gstin_registry.csv' for n in outer.namelist()):
            prepare(outer)
        else:
            data = member(outer, 'YTL_TrackA_Udyam_Digital_Data.zip')
            with ZipFile(io.BytesIO(data)) as inner:
                prepare(inner)
