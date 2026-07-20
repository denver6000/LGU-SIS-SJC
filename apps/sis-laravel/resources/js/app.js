document.addEventListener('DOMContentLoaded', () => {
    const rail = document.querySelector('[data-rail]');
    const backdrop = document.querySelector('[data-rail-backdrop]');
    const setOpen = (open) => {
        rail?.classList.toggle('open', open);
        backdrop?.classList.toggle('open', open);
    };
    document.querySelector('[data-rail-toggle]')?.addEventListener('click', () => setOpen(true));
    document.querySelector('[data-rail-close]')?.addEventListener('click', () => setOpen(false));
    backdrop?.addEventListener('click', () => setOpen(false));
});

import './payroll-export';
