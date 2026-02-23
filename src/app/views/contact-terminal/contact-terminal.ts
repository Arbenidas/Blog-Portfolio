import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact-terminal',
  imports: [CommonModule],
  templateUrl: './contact-terminal.html',
  styleUrl: './contact-terminal.css',
})
export class ContactTerminal {
  status = signal<'idle' | 'sending' | 'success' | 'error'>('idle');

  onSubmit(event: Event) {
    event.preventDefault();
    this.status.set('sending');

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData as any).toString()
    })
      .then(() => {
        this.status.set('success');
        form.reset();
      })
      .catch((error) => {
        this.status.set('error');
        console.error(error);
      });
  }
}
