import { Component } from '@angular/core';
import { InspenctorComponent } from 'inspenctor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [InspenctorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {}
