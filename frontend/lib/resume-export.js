import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from 'docx';

function slugifyFilename(title) {
  return (title || 'resume')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'resume';
}

function normalizeSkillNames(skills) {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean);
}

function buildContactLine(contact) {
  if (!contact) return '';
  return [
    contact.email,
    contact.phone,
    contact.location,
    contact.linkedin_url,
    contact.github_url,
  ]
    .filter(Boolean)
    .join('  •  ');
}

/**
 * Generate and download an industry-standard, ATS-friendly PDF resume.
 */
export function exportResumeAsPdf(data, contact = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 10) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  const drawSectionHeader = (label) => {
    ensureSpace(12);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 27, 45); // #0F1B2D
    doc.text(label.toUpperCase(), margin, y);
    y += 1.8;
    doc.setDrawColor(184, 149, 90); // #B8955A
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;
  };

  // Header: Name / Title
  const headerName = contact?.display_name || data.title || 'Resume';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 27, 45);
  doc.text(headerName, margin, y);
  y += 6.5;

  if (data.target_role) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(128, 98, 54); // #806236
    doc.text(data.target_role, margin, y);
    y += 5;
  }

  const contactLine = buildContactLine(contact);
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    const contactLines = doc.splitTextToSize(contactLine, maxWidth);
    doc.text(contactLines, margin, y);
    y += contactLines.length * 4 + 1;
  }

  // Professional Summary
  if (data.summary) {
    drawSectionHeader('Professional Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(data.summary, maxWidth);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.4;
    }
    y += 1.5;
  }

  // Work Experience
  const experiences = Array.isArray(data.experiences) ? data.experiences : [];
  if (experiences.length > 0) {
    drawSectionHeader('Work Experience');
    for (const exp of experiences) {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 27, 45);
      const roleLine = [exp.role_title, exp.company].filter(Boolean).join(' — ');
      doc.text(roleLine || 'Role', margin, y);

      if (exp.period_label) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(exp.period_label, pageWidth - margin, y, { align: 'right' });
      }
      y += 4.8;

      const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.3);
      doc.setTextColor(31, 41, 55);
      for (const bullet of bullets) {
        const wrapped = doc.splitTextToSize(`•  ${bullet}`, maxWidth - 3);
        for (let i = 0; i < wrapped.length; i += 1) {
          ensureSpace(4.5);
          doc.text(wrapped[i], margin + (i === 0 ? 1.5 : 4.5), y);
          y += 4.3;
        }
      }
      y += 2.5;
    }
  }

  // Education
  const education = Array.isArray(data.education) ? data.education : [];
  if (education.length > 0) {
    drawSectionHeader('Education');
    for (const edu of education) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 27, 45);
      doc.text(edu.degree || 'Degree', margin, y);

      if (edu.year_label) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(edu.year_label, pageWidth - margin, y, { align: 'right' });
      }
      y += 4.4;

      if (edu.school) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.3);
        doc.setTextColor(75, 85, 99);
        doc.text(edu.school, margin, y);
        y += 5;
      }
    }
  }

  // Skills
  const skillNames = normalizeSkillNames(data.skills);
  if (skillNames.length > 0) {
    drawSectionHeader('Core Skills');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(skillNames.join('  •  '), maxWidth);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
  }

  doc.save(`${slugifyFilename(data.title)}.pdf`);
}

function docxSectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    border: {
      bottom: {
        color: 'B8955A',
        space: 3,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 21,
        color: '0F1B2D',
        font: 'Calibri',
      }),
    ],
  });
}

/**
 * Generate and download an industry-standard, ATS-friendly Word (.docx) resume.
 */
export async function exportResumeAsDocx(data, contact = null) {
  const children = [];
  const headerName = contact?.display_name || data.title || 'Resume';

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: headerName,
          bold: true,
          size: 36,
          color: '0F1B2D',
          font: 'Calibri',
        }),
      ],
    }),
  );

  if (data.target_role) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: data.target_role,
            size: 22,
            color: '806236',
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  const contactLine = buildContactLine(contact);
  if (contactLine) {
    children.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: contactLine,
            size: 18,
            color: '6B7280',
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  if (data.summary) {
    children.push(docxSectionHeading('Professional Summary'));
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: data.summary,
            size: 21,
            color: '1F2937',
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  const experiences = Array.isArray(data.experiences) ? data.experiences : [];
  if (experiences.length > 0) {
    children.push(docxSectionHeading('Work Experience'));
    for (const exp of experiences) {
      const roleRuns = [
        new TextRun({
          text: [exp.role_title, exp.company].filter(Boolean).join(' — ') || 'Role',
          bold: true,
          size: 22,
          color: '0F1B2D',
          font: 'Calibri',
        }),
      ];
      if (exp.period_label) {
        roleRuns.push(
          new TextRun({
            text: `   (${exp.period_label})`,
            size: 19,
            color: '6B7280',
            font: 'Calibri',
          }),
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: roleRuns,
        }),
      );

      const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
      for (const bullet of bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: bullet,
                size: 20,
                color: '1F2937',
                font: 'Calibri',
              }),
            ],
          }),
        );
      }
    }
  }

  const education = Array.isArray(data.education) ? data.education : [];
  if (education.length > 0) {
    children.push(docxSectionHeading('Education'));
    for (const edu of education) {
      const eduRuns = [
        new TextRun({
          text: edu.degree || 'Degree',
          bold: true,
          size: 21,
          color: '0F1B2D',
          font: 'Calibri',
        }),
      ];
      if (edu.year_label) {
        eduRuns.push(
          new TextRun({
            text: `   (${edu.year_label})`,
            size: 19,
            color: '6B7280',
            font: 'Calibri',
          }),
        );
      }
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: eduRuns,
        }),
      );
      if (edu.school) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: edu.school,
                size: 20,
                color: '4B5563',
                font: 'Calibri',
              }),
            ],
          }),
        );
      }
    }
  }

  const skillNames = normalizeSkillNames(data.skills);
  if (skillNames.length > 0) {
    children.push(docxSectionHeading('Core Skills'));
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: skillNames.join('  •  '),
            size: 20,
            color: '1F2937',
            font: 'Calibri',
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyFilename(data.title)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
