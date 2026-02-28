import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FieldGuide } from './field-guide';

describe('FieldGuide', () => {
  let component: FieldGuide;
  let fixture: ComponentFixture<FieldGuide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldGuide]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FieldGuide);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
