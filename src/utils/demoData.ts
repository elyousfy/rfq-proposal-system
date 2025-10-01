// Demo data for testing the completed proposals feature
import type { Proposal } from '../lib';

export const createDemoCompletedProposals = () => {
  const demoProposals: Proposal[] = [
    {
      id: 'demo-1',
      title: 'IT Infrastructure Modernization Proposal',
      rfqName: 'City of Springfield IT Modernization RFP',
      sections: [
        {
          id: 'exec-1',
          title: 'Executive Summary',
          contentMd: '# Executive Summary\n\nWe propose a comprehensive IT infrastructure modernization that will transform the City of Springfield\'s technology capabilities. Our solution includes:\n\n- Cloud migration strategy\n- Enhanced cybersecurity framework\n- Legacy system integration\n- Staff training and support\n\nThis proposal delivers measurable ROI within 18 months and positions Springfield as a technology leader among municipal organizations.',
          level: 1
        },
        {
          id: 'scope-1',
          title: 'Project Scope',
          contentMd: '# Project Scope\n\n## Included Services\n\n- Infrastructure assessment and planning\n- Cloud platform setup and migration\n- Security implementation\n- Training and documentation\n- 12 months of support\n\n## Timeline\n\n- Phase 1: Assessment (4 weeks)\n- Phase 2: Migration (12 weeks)\n- Phase 3: Testing (4 weeks)\n- Phase 4: Go-live (2 weeks)',
          level: 1
        },
        {
          id: 'team-1',
          title: 'Project Team',
          contentMd: '# Project Team\n\n## Key Personnel\n\n- **Project Manager**: Sarah Johnson, PMP\n- **Lead Architect**: Michael Chen, CISSP\n- **Cloud Specialist**: Emily Rodriguez, AWS Certified\n- **Security Expert**: David Kim, CISO\n\nOur team brings over 50 years of combined experience in municipal IT transformations.',
          level: 1
        }
      ],
      variables: [
        { key: 'client_name', label: 'Client Name', value: 'City of Springfield' },
        { key: 'rfq_title', label: 'RFQ Title', value: 'IT Infrastructure Modernization' }
      ],
      compliance: [],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T15:30:00Z',
      versions: []
    },
    {
      id: 'demo-2',
      title: 'Software Development Services Proposal',
      rfqName: 'Acme Corp Custom CRM System',
      sections: [
        {
          id: 'exec-2',
          title: 'Executive Summary',
          contentMd: '# Executive Summary\n\nAcme Corp requires a custom CRM solution to streamline sales processes and improve customer relationships. Our proposal delivers:\n\n- Modern, responsive web application\n- Integration with existing systems\n- Advanced analytics and reporting\n- Mobile accessibility\n\nWe will deliver a production-ready system in 16 weeks using agile development methodologies.',
          level: 1
        },
        {
          id: 'tech-2',
          title: 'Technical Approach',
          contentMd: '# Technical Approach\n\n## Technology Stack\n\n- **Frontend**: React with TypeScript\n- **Backend**: Node.js with Express\n- **Database**: PostgreSQL with Redis caching\n- **Hosting**: AWS with auto-scaling\n\n## Development Process\n\n- Agile/Scrum methodology\n- 2-week sprints\n- Continuous integration/deployment\n- Automated testing coverage > 90%',
          level: 1
        }
      ],
      variables: [
        { key: 'client_name', label: 'Client Name', value: 'Acme Corporation' },
        { key: 'rfq_title', label: 'RFQ Title', value: 'Custom CRM System Development' }
      ],
      compliance: [],
      createdAt: '2024-02-01T09:00:00Z',
      updatedAt: '2024-02-05T14:45:00Z',
      versions: []
    },
    {
      id: 'demo-3',
      title: 'Cybersecurity Assessment and Implementation',
      rfqName: 'Regional Hospital Security Audit RFP',
      sections: [
        {
          id: 'exec-3',
          title: 'Executive Summary',
          contentMd: '# Executive Summary\n\nRegional Hospital requires comprehensive cybersecurity assessment and implementation to protect patient data and meet HIPAA compliance. Our proposal includes:\n\n- Full security audit and vulnerability assessment\n- Implementation of security frameworks\n- Staff training and awareness programs\n- 24/7 security monitoring\n\nWe ensure complete HIPAA compliance and industry-leading security posture.',
          level: 1
        },
        {
          id: 'compliance-3',
          title: 'Compliance Framework',
          contentMd: '# Compliance Framework\n\n## HIPAA Compliance\n\n- Administrative safeguards\n- Physical safeguards\n- Technical safeguards\n- Risk assessment procedures\n\n## Security Standards\n\n- NIST Cybersecurity Framework\n- ISO 27001 alignment\n- SOC 2 Type II compliance\n- Regular penetration testing',
          level: 1
        }
      ],
      variables: [
        { key: 'client_name', label: 'Client Name', value: 'Regional Hospital' },
        { key: 'rfq_title', label: 'RFQ Title', value: 'Cybersecurity Assessment' }
      ],
      compliance: [],
      createdAt: '2024-03-10T11:30:00Z',
      updatedAt: '2024-03-15T16:20:00Z',
      versions: []
    }
  ];

  return demoProposals;
};

export const loadDemoData = () => {
  const existingData = localStorage.getItem('completed-proposals');
  if (!existingData) {
    console.log('📋 Loading demo data...');
    const demoProposals = createDemoCompletedProposals();

    // Convert to completed proposal format
    const completedProposals = demoProposals.map(proposal => ({
      id: proposal.id,
      title: proposal.title,
      rfqName: proposal.rfqName,
      client: proposal.variables?.find(v => v.key === 'client_name')?.value || 'Demo Client',
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      sectionsCount: proposal.sections.length,
      wordCount: proposal.sections.reduce((total, section) => {
        const content = section.contentMd || '';
        if (!content.trim()) return total;
        return total + content.trim().split(/\s+/).length;
      }, 0),
      status: 'completed' as const,
      templateUsed: 'Demo Template'
    }));


    localStorage.setItem('completed-proposals', JSON.stringify(completedProposals));

    // Save full proposal data
    demoProposals.forEach(proposal => {
      localStorage.setItem(`proposal-${proposal.id}`, JSON.stringify(proposal));
    });

    console.log('✅ Demo data loaded for completed proposals');
  }
};