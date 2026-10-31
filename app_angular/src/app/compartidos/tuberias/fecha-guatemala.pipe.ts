import { Pipe, PipeTransform } from '@angular/core';

/** Presenta fechas sin alterar el valor recibido desde Oracle. */
@Pipe({ name: 'fechaGuatemala', standalone: true })
export class FechaGuatemalaPipe implements PipeTransform {
  transform(valor: string | Date | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    const texto = String(valor).trim();
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (soloFecha) return `${soloFecha[3]}-${soloFecha[2]}-${soloFecha[1]}`;
    const fecha = valor instanceof Date ? valor : new Date(texto);
    if (Number.isNaN(fecha.getTime())) return '—';
    const partes = new Intl.DateTimeFormat('es-GT', {
      timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(fecha).reduce<Record<string, string>>((acumulado, parte) => {
      acumulado[parte.type] = parte.value;
      return acumulado;
    }, {});
    return `${partes['day']}-${partes['month']}-${partes['year']} ${partes['hour']}:${partes['minute']}:${partes['second']}`;
  }
}
