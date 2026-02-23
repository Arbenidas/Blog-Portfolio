import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="share-container">
      <div class="channels-header">
        <span class="transmission-label">TRANSMISSION_CHANNELS</span>
        <div class="header-line"></div>
      </div>
      
      <div class="buttons-grid">
        <!-- Facebook -->
        <button (click)='share("facebook")' class="share-btn fb-btn">
          <div class="btn-content">
            <span class="material-symbols-outlined icon">share</span>
            <span class="label">FACEBOOK</span>
          </div>
          <div class="btn-shadow"></div>
        </button>

        <!-- LinkedIn -->
        <button (click)='share("linkedin")' class="share-btn li-btn">
          <div class="btn-content">
            <span class="material-symbols-outlined icon">work</span>
            <span class="label">LINKEDIN</span>
          </div>
          <div class="btn-shadow"></div>
        </button>

        <!-- X / Twitter -->
        <button (click)='share("twitter")' class="share-btn x-btn">
          <div class="btn-content">
            <span class="material-symbols-outlined icon">podcasts</span>
            <span class="label">X / TWITTER</span>
          </div>
          <div class="btn-shadow"></div>
        </button>

        <!-- Copy Link -->
        <button (click)="copyLink()" [class.copied]="copied" class="share-btn copy-btn">
          <div class="btn-content">
            <span class="material-symbols-outlined icon">{{ copied ? 'check' : 'link' }}</span>
            <span class="label">{{ copied ? 'COPIED!' : 'COPY_LINK' }}</span>
          </div>
          <div class="btn-shadow"></div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin-top: 3rem; }
    
    .share-container {
      padding-top: 2rem;
      border-top: 2px dashed rgba(26, 26, 26, 0.2);
    }

    .channels-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .transmission-label {
      font-family: var(--font-mono, 'Space Mono', monospace);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: rgba(26, 26, 26, 0.5);
      white-space: nowrap;
    }

    .header-line {
      flex: 1;
      height: 1px;
      background: repeating-linear-gradient(90deg, rgba(26, 26, 26, 0.2), rgba(26, 26, 26, 0.2) 4px, transparent 4px, transparent 8px);
    }

    .buttons-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
    }

    .share-btn {
      position: relative;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: transform 0.1s ease;
    }

    .btn-content {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 1.25rem;
      background: white;
      border: 2px solid #1a1a1a;
      transition: transform 0.1s ease;
    }

    .btn-shadow {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 100%;
      height: 100%;
      background: #1a1a1a;
      z-index: 1;
      transition: transform 0.1s ease;
    }

    .icon {
      font-size: 1.25rem;
    }

    .label {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-weight: 900;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    /* Hover States */
    .share-btn:hover .btn-content {
      transform: translate(-1px, -1px);
    }
    
    .share-btn:active .btn-content {
      transform: translate(2px, 2px);
    }
    
    .share-btn:active .btn-shadow {
      transform: translate(-2px, -2px);
    }

    /* Specific Button Styles */
    .fb-btn:hover .btn-content { border-color: #1877f2; color: #1877f2; }
    .li-btn:hover .btn-content { border-color: #0077b5; color: #0077b5; }
    .x-btn:hover .btn-content { border-color: #000000; color: #000000; }
    
    .copy-btn .btn-content {
      background: var(--accent-orange, #d94e1e);
      color: white;
    }
    
    .copy-btn.copied .btn-content {
      background: #10b981; /* Success Green */
    }

    @media (max-width: 640px) {
      .buttons-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .share-btn { width: 100%; }
      .btn-content { justify-content: center; }
    }
  `]
})
export class ShareButtons {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() image: string = '';

  copied = false;

  share(platform: string) {
    const url = window.location.href;
    const text = encodeURIComponent(`${this.title} - ${this.description}`);

    let shareUrl = '';
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }
}
