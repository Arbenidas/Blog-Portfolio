import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="share-container">
      <div class="channels-header">
        <span class="transmission-label">
          <div class="live-dot"></div>
          TRANSMISSION_CHANNELS
        </span>
        <div class="header-line"></div>
      </div>
      
      <div class="buttons-grid">
        <!-- Facebook -->
        <button (click)='share("facebook")' class="share-btn fb-btn">
          <div class="btn-shadow"></div>
          <div class="btn-content">
            <span class="material-symbols-outlined icon">share</span>
            <span class="label">FACEBOOK</span>
          </div>
        </button>

        <!-- LinkedIn -->
        <button (click)='share("linkedin")' class="share-btn li-btn">
          <div class="btn-shadow"></div>
          <div class="btn-content">
            <span class="material-symbols-outlined icon">work</span>
            <span class="label">LINKEDIN</span>
          </div>
        </button>

        <!-- X / Twitter -->
        <button (click)='share("twitter")' class="share-btn x-btn">
          <div class="btn-shadow"></div>
          <div class="btn-content">
            <span class="material-symbols-outlined icon">podcasts</span>
            <span class="label">X / TWITTER</span>
          </div>
        </button>

        <!-- Copy Link -->
        <button (click)="copyLink()" [class.copied]="copied" class="share-btn copy-btn">
          <div class="btn-shadow"></div>
          <div class="btn-content">
            <span class="material-symbols-outlined icon">{{ copied ? 'check' : 'link' }}</span>
            <span class="label">{{ copied ? 'COPIED!' : 'COPY_LINK' }}</span>
          </div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; margin-top: 3rem; width: 100%; }
    
    .share-container {
      padding-top: 2.5rem;
      border-top: 2px dashed rgba(26, 26, 26, 0.4);
      position: relative;
    }

    /* Technical decorative element */
    .share-container::before {
      content: 'SYS_SHARE_MOD';
      position: absolute;
      top: -10px;
      right: 1rem;
      background: #f3f4f6; /* Matching the typical background or white */
      background: var(--bg-color, white);
      padding: 0 0.5rem;
      font-family: var(--font-mono, 'Space Mono', monospace);
      font-size: 0.65rem;
      font-weight: bold;
      color: var(--charcoal, #1a1a1a);
    }

    .channels-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .transmission-label {
      font-family: var(--font-mono, 'Space Mono', monospace);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--charcoal, #1a1a1a);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      background-color: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .header-line {
      flex: 1;
      height: 2px;
      background: var(--charcoal, #1a1a1a);
    }

    .buttons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
    }

    .share-btn {
      position: relative;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      outline: none;
      width: 100%;
    }

    .btn-content {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      background: white;
      border: 2px solid var(--charcoal, #1a1a1a);
      color: var(--charcoal, #1a1a1a);
      transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 0.2s ease, border-color 0.2s ease;
      overflow: hidden;
    }

    /* Glitch / Strip effect on hover */
    .btn-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: var(--charcoal, #1a1a1a);
      transition: left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      z-index: -1;
    }

    .btn-shadow {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(
        45deg,
        var(--charcoal, #1a1a1a),
        var(--charcoal, #1a1a1a) 2px,
        transparent 2px,
        transparent 6px
      );
      border: 2px solid var(--charcoal, #1a1a1a);
      z-index: 1;
      transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease;
    }

    .icon {
      font-size: 1.25rem;
      transition: transform 0.3s ease;
    }

    .label {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-weight: 800;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
    }

    /* Hover States - Cyber-Brutalist Impact */
    .share-btn:hover .btn-content {
      transform: translate(-3px, -3px);
      color: white;
      border-color: var(--charcoal, #1a1a1a);
    }
    
    .share-btn:hover .btn-content::before {
      left: 0; /* Slide in the dark background */
    }

    .share-btn:hover .btn-shadow {
      transform: translate(3px, 3px);
    }
    
    .share-btn:hover .icon {
      transform: scale(1.1) rotate(-5deg);
    }

    .share-btn:active .btn-content {
      transform: translate(4px, 4px);
    }
    
    .share-btn:active .btn-shadow {
      transform: translate(-4px, -4px);
      opacity: 0;
    }

    /* Platform specific hover colors */
    .fb-btn:hover .btn-content::before { background: #1877f2; }
    .fb-btn:hover .btn-content { border-color: #1877f2; }
    
    .li-btn:hover .btn-content::before { background: #0077b5; }
    .li-btn:hover .btn-content { border-color: #0077b5; }
    
    .x-btn:hover .btn-content::before { background: #000000; }
    .x-btn:hover .btn-content { border-color: #000000; }

    /* Copy Button Specific */
    .copy-btn .btn-content {
      background: var(--accent-orange, #d94e1e);
      color: white;
      border-color: var(--charcoal, #1a1a1a);
    }
    .copy-btn .btn-content::before {
      background: var(--charcoal, #1a1a1a);
    }
    
    .copy-btn.copied .btn-content {
      background: #10b981; /* Success Green */
      border-color: #10b981;
    }
    .copy-btn.copied .btn-content::before {
      background: #059669; /* Darker green for hover */
    }

    @media (max-width: 640px) {
      .buttons-grid {
        grid-template-columns: 1fr 1fr;
      }
      .transmission-label {
        font-size: 0.65rem;
      }
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
