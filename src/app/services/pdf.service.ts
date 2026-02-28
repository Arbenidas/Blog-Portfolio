import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { jsPDF } from 'jspdf';
// html2canvas is imported dynamically inside the method to avoid SSR issues

@Injectable({
    providedIn: 'root'
})
export class PdfService {
    private platformId = inject(PLATFORM_ID);

    /**
     * Captures an HTML element and generates a downloadable PDF.
     * Handles multi-page splitting if the content is too tall.
     * Only runs in the browser (skipped during SSR).
     */
    async downloadElementToPdf(element: HTMLElement, filename: string): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            // Dynamically import html2canvas to avoid SSR issues
            const html2canvasModule = await import('html2canvas');
            const html2canvas = html2canvasModule.default || html2canvasModule;

            if (typeof html2canvas !== 'function') {
                throw new Error('html2canvas failed to resolve as a function.');
            }

            // 1. Capture the element
            // Save original scroll position
            const originalScrollY = window.scrollY;
            window.scrollTo(0, 0);

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: true, // Turn on logging to see where it breaks in console
                scrollY: 0,
                x: 0,
                y: 0,
                width: element.scrollWidth,
                height: element.scrollHeight
            });

            // Restore scroll position
            window.scrollTo(0, originalScrollY);

            // 2. Calculate dimensions for A4 format (210 x 297 mm)
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            const contentDataURL = canvas.toDataURL('image/png');

            // 3. Initialize jsPDF (portrait, millimeters, A4)
            const pdf = new jsPDF('p', 'mm', 'a4');
            let position = 0;

            pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // 4. Trigger download
            pdf.save(`${filename}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }
}
