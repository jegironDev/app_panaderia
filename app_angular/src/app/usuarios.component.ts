import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from './api.service';
@Component({standalone:true,imports:[RouterLink,CommonModule],template:`<main class="container py-4"><nav><a routerLink="/usuarios">Usuarios</a> | <a routerLink="/usuarios/nuevo">Nuevo usuario</a></nav><h1>Usuarios</h1><p class="text-danger">{{error}}</p><table class="table"><tr><th>Usuario</th><th>Nombre</th><th>Estado</th></tr><tr *ngFor="let u of usuarios"><td>{{u.USUARIO}}</td><td>{{u.PRIMER_NOMBRE}} {{u.PRIMER_APELLIDO}}</td><td>{{u.ESTADO}}</td></tr></table></main>`})
export class UsuariosComponent implements OnInit {usuarios:any[]=[];error='';constructor(private api:ApiService){}ngOnInit(){this.api.usuarios().subscribe({next:r=>this.usuarios=r,error:e=>this.error=e.error?.error||'No fue posible consultar usuarios'})}}
