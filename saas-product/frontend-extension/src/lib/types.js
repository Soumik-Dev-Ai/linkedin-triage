/* ─── Shared TypeScript interfaces ─── */
export const CATEGORY_REPLIES = {
    CANDIDATE: 'Thank you for reaching out! We are currently reviewing your resume and qualifications. A member of our team will be contacting you soon regarding next steps.',
    SALES: 'Thank you for your message. We are currently discussing your proposal with our team and will reach out if we find a potential fit for our needs.',
    IRRELEVANT: 'Thanks for connecting! We appreciate your message. As this thread doesn\'t require further discussion, we\'ll be closing it for now. Feel free to reach out if you have specific opportunities or inquiries.',
};
export const CATEGORY_CONFIG = {
    IMPORTANT: {
        label: 'Important',
        className: 'badge-important',
        color: 'oklch(0.7 0.15 30)', // Orange/Red color
    },
    CANDIDATE: {
        label: 'Candidate',
        className: 'badge-candidate',
        color: 'oklch(0.72 0.1 155)',
    },
    SALES: {
        label: 'Sales',
        className: 'badge-sales',
        color: 'oklch(0.72 0.08 60)',
    },
    IRRELEVANT: {
        label: 'Irrelevant',
        className: 'badge-irrelevant',
        color: 'oklch(0.6 0.01 260)',
    },
};
