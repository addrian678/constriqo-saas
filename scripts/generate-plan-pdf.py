from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "ConstructFlow_Plan_Actualizado.pdf"

SOURCES = [
    ROOT / "docs" / "product-delivery-update-security-plan.md",
    ROOT / "docs" / "constructflow-execution-plan-v4-analysis.md",
    ROOT / "docs" / "adr" / "0003-modular-monolith-before-microservices.md",
]


def clean_inline(text: str) -> str:
    text = text.strip()
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text


def load_markdown(path: Path) -> list[str]:
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawString(0.72 * inch, 0.45 * inch, "ConstructFlow - Plan actualizado")
    canvas.drawRightString(7.78 * inch, 0.45 * inch, f"Pagina {doc.page}")
    canvas.restoreState()


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=34,
            textColor=colors.HexColor("#12233a"),
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=23,
            textColor=colors.HexColor("#12233a"),
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1c3656"),
            spaceBefore=9,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyPlan",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.2,
            textColor=colors.HexColor("#202936"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletPlan",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12.5,
            leftIndent=14,
            firstLineIndent=-8,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.7,
            leading=11,
            textColor=colors.HexColor("#202936"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=11,
            textColor=colors.HexColor("#202936"),
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title="ConstructFlow - Plan Actualizado",
        author="ConstructFlow",
    )

    story = []
    story.append(Paragraph("ConstructFlow", styles["CoverTitle"]))
    story.append(Paragraph("Plan maestro actualizado", styles["SectionTitle"]))
    story.append(
        Paragraph(
            "Software web/PWA SaaS multi-tenant, con aislamiento por tenant, actualizaciones centralizadas, "
            "proteccion de codigo, arquitectura evolutiva, Super Admin/licencias y modulos operativos por fase.",
            styles["BodyPlan"],
        )
    )
    story.append(Spacer(1, 0.18 * inch))

    summary_data = [
        ["Modelo", "SaaS multi-tenant gestionado por proveedor, con aislamiento estricto por tenant"],
        ["Entrega", "Web/PWA primero; Android despues como wrapper/app nativa que consume la misma API"],
        ["Datos", "PostgreSQL/Supabase por tenant logico; exportacion y migracion futura a NAS/VPS/storage propio"],
        ["Arquitectura", "Monolito modular primero; microservicios extraibles solo donde mejoren seguridad o escala"],
        ["Actualizaciones", "Versionado, migraciones, backup, smoke tests y rollback"],
        ["Codigo", "Repo privado; no entregar fuente salvo contrato especial"],
        ["Super Admin", "Clientes SaaS, licencias, vencimientos, cuotas, uso y alertas"],
        ["Marketing", "Campanas, leads, fidelizacion/codigos y conversion a cliente"],
    ]
    summary_data = [
        [Paragraph(clean_inline(label), styles["TableLabel"]), Paragraph(clean_inline(value), styles["TableCell"])]
        for label, value in summary_data
    ]
    table = Table(summary_data, colWidths=[1.65 * inch, 4.95 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef4fb")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#202936")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.7),
                ("LEADING", (0, 0), (-1, -1), 11),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d8dee8")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d8dee8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["BodyPlan"]))
    story.append(PageBreak())

    for source in SOURCES:
        lines = load_markdown(source)
        if not lines:
            continue
        story.append(Paragraph(source.name, styles["SectionTitle"]))
        for raw in lines:
            line = raw.rstrip()
            if not line:
                story.append(Spacer(1, 0.04 * inch))
                continue
            if line.startswith("# "):
                story.append(Paragraph(clean_inline(line[2:]), styles["SectionTitle"]))
            elif line.startswith("## "):
                story.append(Paragraph(clean_inline(line[3:]), styles["SubTitle"]))
            elif line.startswith("### "):
                story.append(Paragraph(clean_inline(line[4:]), styles["SubTitle"]))
            elif line.startswith("- "):
                story.append(Paragraph("- " + clean_inline(line[2:]), styles["BulletPlan"]))
            elif re.match(r"^\d+\.\s", line):
                story.append(Paragraph(clean_inline(line), styles["BulletPlan"]))
            else:
                story.append(Paragraph(clean_inline(line), styles["BodyPlan"]))
        story.append(PageBreak())

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)


if __name__ == "__main__":
    build_pdf()
