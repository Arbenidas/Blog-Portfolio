import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ad-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ad-modal.html',
  styleUrl: './ad-modal.css'
})
export class AdModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() downloadReady = new EventEmitter<void>();
  @Output() closeEvent = new EventEmitter<void>();

  timeLeft = 5;
  isDownloading = false;
  private timerInt: any;

  ngOnInit() { }

  ngOnDestroy() {
    this.clearTimer();
  }

  open() {
    this.isOpen = true;
    this.timeLeft = 5;
    this.isDownloading = false;
    this.startTimer();
    // Trigger AdSense to fill the ad slot
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) { /* AdSense not loaded or ad blocker active */ }
  }

  close() {
    this.isOpen = false;
    this.clearTimer();
    this.closeEvent.emit();
  }

  private startTimer() {
    this.clearTimer();
    this.timerInt = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.clearTimer();
        // Automatically trigger download when timer reaches 0
        this.triggerDownload();
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timerInt) {
      clearInterval(this.timerInt);
    }
  }

  triggerDownload() {
    if (this.isDownloading) return;
    this.isDownloading = true;
    this.downloadReady.emit();
  }
}
