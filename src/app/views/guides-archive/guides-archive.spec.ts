import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuidesArchive } from './guides-archive';

describe('GuidesArchive', () => {
  let component: GuidesArchive;
  let fixture: ComponentFixture<GuidesArchive>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuidesArchive]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuidesArchive);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
