"""Small HTML tree used by the static blog builder; no third-party dependencies."""
from dataclasses import dataclass, field
from html import escape, unescape
from html.parser import HTMLParser

VOID = set("area base br col embed hr img input link meta param source track wbr".split())


@dataclass
class Node:
    tag: str = ""
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    data: str = ""

    def has_class(self, name):
        return name in (self.attrs.get("class") or "").split()

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def find(self, tag=None, cls=None):
        return next((n for n in self.walk() if n.tag and
                     (tag is None or n.tag == tag) and
                     (cls is None or n.has_class(cls))), None)

    def text(self):
        if not self.tag:
            if self.data:
                return unescape(self.data) if not self.data.startswith("<!--") else ""
            return "".join(child.text() for child in self.children)
        return "".join(child.text() for child in self.children)

    def html(self):
        if not self.tag:
            return self.data or "".join(child.html() for child in self.children)
        attributes = "".join(" " + name + ("" if value is None else
                              '="' + escape(str(value), quote=True) + '"')
                              for name, value in self.attrs.items())
        start = "<" + self.tag + attributes + ">"
        return start if self.tag in VOID else start + "".join(
            child.html() for child in self.children) + "</" + self.tag + ">"


class TreeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(Node(data=data))

    def handle_entityref(self, name):
        self.handle_data("&" + name + ";")

    def handle_charref(self, name):
        self.handle_data("&#" + name + ";")

    def handle_comment(self, data):
        self.handle_data("<!--" + data + "-->")

    def handle_decl(self, decl):
        self.handle_data("<!" + decl + ">")


def parse(text):
    parser = TreeParser()
    parser.feed(text)
    parser.close()
    return parser.root


def set_text(node, text):
    node.children = [Node(data=escape(text))]


def remove_where(node, predicate):
    node.children = [child for child in node.children if not predicate(child)]
    for child in node.children:
        remove_where(child, predicate)
