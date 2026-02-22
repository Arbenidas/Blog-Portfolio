import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-home-view',
  imports: [DecimalPipe],
  templateUrl: './home-view.html',
  styleUrl: './home-view.css',
})
export class HomeView implements OnInit, OnDestroy {
  cpuGhz = signal(88.4);
  tempCelsius = signal(45.2);
  uptime = signal('12:04:11');

  private intervalId: any;
  private uptimeSeconds = 12 * 3600 + 4 * 60 + 11; // 12:04:11 in seconds

  ngOnInit() {
    // Start the diagnostics simulation loop
    this.intervalId = setInterval(() => {
      // Simulate CPU fluctuation between 86.0 and 89.9
      this.cpuGhz.set(86 + Math.random() * 3.9);

      // Simulate Temp fluctuation between 44.0 and 46.5
      this.tempCelsius.set(44 + Math.random() * 2.5);

      // Update uptime counter
      this.uptimeSeconds++;
      const h = Math.floor(this.uptimeSeconds / 3600);
      const m = Math.floor((this.uptimeSeconds % 3600) / 60);
      const s = this.uptimeSeconds % 60;

      const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      this.uptime.set(formattedTime);
    }, 1000);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
