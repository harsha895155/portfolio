/**
 * Document Information Extraction Processor
 * Analyzes uploaded documents (PDF, TXT, DOCX) and extracts structured data.
 */

const fs = require('fs');
const pdfParse = require('pdf-parse');
const logger = require('../../../shared/utils/logger');

class DocumentExtractor {
  async extract(filePath, ext) {
    try {
      let rawText = '';
      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        rawText = pdfData.text || '';
      } else if (ext === '.txt') {
        rawText = fs.readFileSync(filePath, 'utf-8');
      } else {
        // Fallback or binary file (images, docs)
        rawText = '';
      }

      const docType = this.detectDocumentType(rawText, filePath);
      const extracted = this.extractEntities(rawText, docType);

      return {
        success: true,
        docType,
        textSnippet: rawText.substring(0, 500).replace(/\s+/g, ' ').trim(),
        textLength: rawText.length,
        extracted
      };
    } catch (err) {
      logger.error(`Error extracting document text from ${filePath}`, err);
      return {
        success: false,
        docType: 'Unknown',
        error: err.message,
        extracted: {}
      };
    }
  }

  detectDocumentType(text, filename) {
    const lower = (text + ' ' + filename).toLowerCase();

    if (lower.includes('resume') || lower.includes('curriculum vitae') || (lower.includes('education') && lower.includes('projects') && lower.includes('skills'))) {
      return 'Resume';
    }
    if (lower.includes('hackathon') || lower.includes('vaultsphere')) {
      return 'Hackathon Certificate';
    }
    if (lower.includes('offer letter') || lower.includes('internship offer') || lower.includes('hearty congratulations on your web development internship offer')) {
      return 'Internship Offer';
    }
    if (lower.includes('certificate') || lower.includes('certify that') || lower.includes('nptel') || lower.includes('coursera') || lower.includes('eduskills') || lower.includes('infosys')) {
      return 'Certification';
    }
    if (lower.includes('marksheet') || lower.includes('grade card') || lower.includes('provisional')) {
      return 'Academic Document';
    }
    return 'Professional Document';
  }

  extractEntities(text, docType) {
    const entities = {
      candidateName: null,
      institution: null,
      issuer: null,
      title: null,
      credentialId: null,
      date: null,
      gradeOrScore: null,
      detectedSkills: [],
      projects: [],
      confidence: 'medium'
    };

    if (!text || text.trim().length === 0) {
      entities.confidence = 'low';
      return entities;
    }

    // 1. Candidate Name
    if (/Thimmareddygari\s+Harshavardhan\s+Reddy/i.test(text)) {
      entities.candidateName = 'Thimmareddygari Harshavardhan Reddy';
    } else if (/Harshavardhan\s+Reddy/i.test(text)) {
      entities.candidateName = 'Harshavardhan Reddy';
    }

    // 2. Issuing Organization
    const issuers = [
      { name: 'NPTEL · IIT Kharagpur', regex: /IIT\s+Kharagpur|NPTEL/i },
      { name: 'IIT Bombay (Spoken Tutorial)', regex: /IIT\s+Bombay|Spoken\s+Tutorial/i },
      { name: 'AWS Academy / EduSkills', regex: /AWS\s+Academy|EduSkills|AWS\s+Gen\s+AI/i },
      { name: 'Google Cloud · Coursera', regex: /Google\s+Cloud|Coursera/i },
      { name: 'Infosys Springboard', regex: /Infosys\s+Springboard|Wingspan/i },
      { name: 'BICS Global', regex: /BICS\s+Global/i },
      { name: 'Amdox Technologies', regex: /Amdox/i },
      { name: 'Vaultsphere AI', regex: /Vaultsphere/i }
    ];

    for (const item of issuers) {
      if (item.regex.test(text)) {
        entities.issuer = item.name;
        break;
      }
    }

    // 3. Credential ID
    const credIdMatch = text.match(/(?:Roll\s*No|Certificate\s*No|Certificate\s*ID|Credential\s*ID|Verify)[:\s]+([A-Za-z0-9\-_]{6,32})/i) ||
                        text.match(/(NPTEL[0-9A-Z]+|[0-9a-f]{16,32}|[A-Z0-9]{10,20})/);
    if (credIdMatch) {
      entities.credentialId = credIdMatch[1];
    }

    // 4. Grade or Score
    const scoreMatch = text.match(/([0-9]{1,3}(?:\.[0-9]+)?%|Grade-[A-O]|Outstanding|Consolidated\s*Score[:\s]+[0-9]+)/i);
    if (scoreMatch) {
      entities.gradeOrScore = scoreMatch[1];
    }

    // 5. Date
    const dateMatch = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*[-–\s]?\s*(?:[0-9]{4}|[A-Za-z]+\s*[0-9]{4})/i) ||
                      text.match(/202[0-9]/);
    if (dateMatch) {
      entities.date = dateMatch[0];
    }

    // 6. Skills extraction
    const skillCatalog = [
      'Java', 'Core Java', 'Python', 'JavaScript', 'TypeScript', 'Rust', 'Go', 'Kotlin', 'C++', 'C', 'SQL',
      'React.js', 'React', 'Node.js', 'Express.js', 'Express', 'Django', 'Vite', 'Tailwind CSS', 'Bootstrap', 'HTML5', 'CSS3',
      'PostgreSQL', 'MongoDB', 'MySQL', 'Redis',
      'AWS', 'Amazon Web Services', 'AWS SageMaker', 'Google Cloud', 'Docker', 'Kubernetes', 'Git', 'GitHub',
      'Generative AI', 'NLP', 'Natural Language Processing', 'Machine Learning', 'Deep Learning',
      'ESP32', 'IoT', 'REST API', 'JWT'
    ];

    const detectedSet = new Set();
    for (const skill of skillCatalog) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(text)) {
        detectedSet.add(skill);
      }
    }
    entities.detectedSkills = Array.from(detectedSet);

    // 7. Title / Certification Name detection
    if (docType === 'Certification' || docType === 'Hackathon Certificate') {
      const titles = [
        'Natural Language Processing — Elite',
        'AWS Academy ML for NLP',
        'Introduction to Responsible AI',
        'Introduction to Generative AI',
        'Introduction to Large Language Models',
        'Explore Machine Learning using Python',
        'Introduction to Artificial Intelligence',
        'Python Full Stack Developer Virtual Internship',
        'Vibrant National Level 48-Hour Hackathon'
      ];
      for (const t of titles) {
        if (text.toLowerCase().includes(t.toLowerCase().replace(/—/g, ''))) {
          entities.title = t;
          break;
        }
      }
    }

    return entities;
  }
}

module.exports = new DocumentExtractor();
