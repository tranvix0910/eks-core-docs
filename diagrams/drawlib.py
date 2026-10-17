"""Tiny helper for writing multi-page draw.io files with AWS / Kubernetes icons."""
import json
import os
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
STYLES = json.load(open(os.path.join(HERE, 'icon-styles.json')))

CONTAINER = 'container=1;pointerEvents=0;collapsible=0;recursiveResize=0;'
GROUPS = {
    'cloud': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_aws_cloud_alt;strokeColor=#232F3E;fillColor=none;fontColor=#232F3E;dashed=0;',
    'region': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;strokeColor=#00A4A6;fillColor=none;fontColor=#147EBA;dashed=1;',
    'vpc': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;fontColor=#8C4FFF;dashed=0;',
    'az': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;strokeColor=#147EBA;fillColor=none;fontColor=#147EBA;dashed=1;',
    'public': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;fontColor=#248814;dashed=0;',
    'private': 'shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;fontColor=#147EBA;dashed=0;',
    'asg': 'shape=mxgraph.aws4.groupCenter;grIcon=mxgraph.aws4.group_auto_scaling_group;grStroke=1;strokeColor=#D86613;fillColor=none;fontColor=#D86613;dashed=1;align=center;spacingTop=25;',
}
GROUP_BASE = 'outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;verticalAlign=top;align=left;spacingLeft=30;'

# Soft fills for plain boxes: (fill, stroke, font)
PALETTE = {
    'blue': ('#dae8fc', '#6c8ebf', '#1a1a1a'),
    'green': ('#d5e8d4', '#82b366', '#1a1a1a'),
    'yellow': ('#fff2cc', '#d6b656', '#1a1a1a'),
    'orange': ('#ffe6cc', '#d79b00', '#1a1a1a'),
    'red': ('#f8cecc', '#b85450', '#1a1a1a'),
    'grey': ('#f5f5f5', '#666666', '#333333'),
    'purple': ('#e1d5e7', '#9673a6', '#1a1a1a'),
    'white': ('#ffffff', '#879196', '#1a1a1a'),
    'eks': ('#FFF8F0', '#ED7100', '#1a1a1a'),
    'k8s': ('#F2F7FE', '#2875E2', '#1a1a1a'),
}
EDGE_COLORS = {
    'default': '#545B64', 'gitops': '#3F8624', 'image': '#2875E2', 'metrics': '#D86613',
    'logs': '#8C4FFF', 'storage': '#7AA116', 'control': '#C7131F', 'net': '#879196', 'tf': '#5C4EE5',
}


class Page:
    def __init__(self, name, width=1800, height=1100):
        self.name, self.width, self.height = name, width, height
        self.cells, self.n = [], 0

    def _id(self, prefix='c'):
        self.n += 1
        return f'{prefix}{self.n}'

    def _vertex(self, value, style, x, y, w, h, parent='1'):
        cid = self._id()
        self.cells.append(
            f'<mxCell id="{cid}" value="{escape(value, {chr(34): "&quot;"})}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return cid

    def group(self, kind, label, x, y, w, h, parent='1'):
        return self._vertex(label, GROUP_BASE + GROUPS[kind] + CONTAINER, x, y, w, h, parent)

    def frame(self, label, x, y, w, h, color='white', parent='1', dashed=False, font=12, bold=True, align='left'):
        f, s, c = PALETTE[color]
        style = (f'rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor={f};strokeColor={s};fontColor={c};'
                 f'verticalAlign=top;align={align};spacingLeft=10;spacingTop=4;fontSize={font};fontStyle={1 if bold else 0};'
                 + ('dashed=1;dashPattern=6 4;' if dashed else '') + CONTAINER)
        return self._vertex(label, style, x, y, w, h, parent)

    def box(self, label, x, y, w, h, color='blue', parent='1', font=11, bold=False, align='center', valign='middle', extra=''):
        f, s, c = PALETTE[color]
        style = (f'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor={f};strokeColor={s};fontColor={c};'
                 f'fontSize={font};fontStyle={1 if bold else 0};align={align};verticalAlign={valign};spacing=6;' + extra)
        return self._vertex(label, style, x, y, w, h, parent)

    def cyl(self, label, x, y, w, h, color='yellow', parent='1', font=11):
        f, s, c = PALETTE[color]
        style = (f'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;whiteSpace=wrap;html=1;'
                 f'fillColor={f};strokeColor={s};fontColor={c};fontSize={font};')
        return self._vertex(label, style, x, y, w, h, parent)

    def text(self, label, x, y, w, h, parent='1', font=12, bold=False, align='left', color='#232F3E', valign='middle'):
        style = (f'text;html=1;whiteSpace=wrap;align={align};verticalAlign={valign};fontSize={font};'
                 f'fontStyle={1 if bold else 0};fontColor={color};')
        return self._vertex(label, style, x, y, w, h, parent)

    def title(self, label, sub=''):
        self.text(label, 20, 10, self.width - 40, 34, font=22, bold=True)
        if sub:
            self.text(sub, 20, 44, self.width - 40, 22, font=13, color='#545B64')

    def icon(self, key, label, x, y, size=None, parent='1', font=11, label_pos='bottom'):
        st = STYLES[key]
        w, h = st['w'], st['h']
        if size:
            scale = size / max(w, h)
            w, h = round(w * scale), round(h * scale)
        base = ';'.join(x for x in st['style'].split(';') if x and not x.lower().startswith('whitespace'))
        style = base + f';fontSize={font};fontColor=#232F3E;html=1;'
        if label_pos == 'top':
            style += 'verticalLabelPosition=top;verticalAlign=bottom;align=center;labelPosition=center;'
        elif label_pos == 'right':
            style += 'verticalLabelPosition=middle;verticalAlign=middle;labelPosition=right;align=left;spacingLeft=4;'
        elif label_pos == 'bottom':
            style += 'verticalLabelPosition=bottom;verticalAlign=top;align=center;labelPosition=center;'
        return self._vertex(label, style, x, y, w, h, parent)

    def edge(self, src, dst, label='', kind='default', dashed=False, points=None, exit=None, entry=None,
             both=False, width=1.5, font=10, lx=None, ly=None):
        color = EDGE_COLORS[kind]
        style = (f'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;'
                 f'strokeColor={color};strokeWidth={width};fontSize={font};fontColor={color};'
                 f'labelBackgroundColor=#ffffff;endArrow=block;endFill=1;')
        if both:
            style += 'startArrow=block;startFill=1;'
        if dashed:
            style += 'dashed=1;dashPattern=6 4;'
        if exit:
            style += f'exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0;'
        if entry:
            style += f'entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;'
        cid = self._id('e')
        geo = '<mxGeometry relative="1" as="geometry">'
        if lx is not None or ly is not None:
            geo = f'<mxGeometry x="{lx or 0}" y="{ly or 0}" relative="1" as="geometry">'
        pts = ''
        if points:
            pts = '<Array as="points">' + ''.join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points) + '</Array>'
        self.cells.append(
            f'<mxCell id="{cid}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}" edge="1" parent="1" '
            f'source="{src}" target="{dst}">{geo}{pts}</mxGeometry></mxCell>')
        return cid

    def legend(self, items, x, y, w=230):
        lid = self.frame('Legend', x, y, w, 34 + 24 * len(items), 'white', font=12)
        for i, (kind, label) in enumerate(items):
            yy = 30 + 24 * i
            self.cells.append(
                f'<mxCell id="{self._id("l")}" value="" style="endArrow=block;endFill=1;html=1;strokeWidth=2;'
                f'strokeColor={EDGE_COLORS[kind]};" edge="1" parent="{lid}">'
                f'<mxGeometry relative="1" as="geometry"><mxPoint x="10" y="{yy + 8}" as="sourcePoint"/>'
                f'<mxPoint x="50" y="{yy + 8}" as="targetPoint"/></mxGeometry></mxCell>')
            self.text(label, 58, yy, w - 66, 18, parent=lid, font=11)
        return lid

    def xml(self):
        body = ''.join(self.cells)
        return (f'<diagram name="{escape(self.name)}" id="{abs(hash(self.name)) % 10**8}">'
                f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
                f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" '
                f'background="#ffffff" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
                f'{body}</root></mxGraphModel></diagram>')


def write(path, pages):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="drawio" version="26.0.0">')
        for p in pages:
            f.write(p.xml())
        f.write('</mxfile>\n')
