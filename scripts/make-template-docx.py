#!/usr/bin/env python3
"""Generates src/scripts/templates/brightline-standard-resume.docx (stdlib only).

Run from the service root: python3 scripts/make-template-docx.py
The output is committed; re-run only when the template content changes.
"""
import zipfile
from xml.sax.saxutils import escape

OUT = "src/scripts/templates/brightline-standard-resume.docx"
FOOTER = "Brightline Analytics resume template (demo data)"

SECTIONS = [
    ("Name", "[Your full name]"),
    ("Contact", "[Email] | [Phone] | [City, Country] | [LinkedIn or portfolio URL]"),
    ("Summary", "[Two or three sentences about who you are and what you do best.]"),
    ("Skills", "[Skill 1], [Skill 2], [Skill 3], [Skill 4]"),
    ("Experience", "[Job title], [Company], [Start - End]\n[One line about an achievement, with a number if possible.]"),
    ("Education", "[Degree], [School], [Year]"),
    ("Projects", "[Project name] - [one line about what you built and the result.]"),
    ("Languages", "[Language] ([level]), [Language] ([level])"),
]

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def run(text, bold=False, size=None, color=None):
    props = ""
    if bold:
        props += "<w:b/>"
    if color:
        props += f'<w:color w:val="{color}"/>'
    if size:
        props += f'<w:sz w:val="{size}"/>'
    rpr = f"<w:rPr>{props}</w:rPr>" if props else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def para(inner, before=0, after=60, jc=None):
    jc_xml = f'<w:jc w:val="{jc}"/>' if jc else ""
    return f'<w:p><w:pPr><w:spacing w:before="{before}" w:after="{after}"/>{jc_xml}</w:pPr>{inner}</w:p>'


body = []
for heading, text in SECTIONS:
    body.append(para(run(heading, bold=True, size=26, color="1F3864"), before=160, after=40))
    for line in text.split("\n"):
        body.append(para(run(line)))

sect = (
    '<w:sectPr><w:footerReference w:type="default" r:id="rId1"/>'
    '<w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>'
    "</w:sectPr>"
)
document = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f"<w:document {W} {R}><w:body>{''.join(body)}{sect}</w:body></w:document>"
)
footer = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f"<w:ftr {W} {R}>{para(run(FOOTER, size=18, color='7F7F7F'), jc='center')}</w:ftr>"
)
content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
    "</Types>"
)
rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    "</Relationships>"
)
doc_rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
    "</Relationships>"
)

# Fixed timestamps so regenerating gives identical bytes.
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for name, data in [
        ("[Content_Types].xml", content_types),
        ("_rels/.rels", rels),
        ("word/document.xml", document),
        ("word/_rels/document.xml.rels", doc_rels),
        ("word/footer1.xml", footer),
    ]:
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 8, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
print("wrote", OUT)
