import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-manifesto',
    standalone: true,
    imports: [CommonModule, RouterModule, TranslateModule],
    templateUrl: './manifesto.html',
    styleUrl: './manifesto.css'
})
export class Manifesto { }
