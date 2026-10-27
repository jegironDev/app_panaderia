import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
@Component({standalone:true,imports:[FormsModule],template:`<main class="container py-5"><h1>Panadería San Carlos</h1><form class="card p-3" (ngSubmit)="ingresar()"><label>Usuario<input class="form-control" name="usuario" [(ngModel)]="usuario" required></label><label>Contraseña<input class="form-control" type="password" name="contrasena" [(ngModel)]="contrasena" required></label><p class="text-danger">{{error}}</p><button class="btn btn-primary">Ingresar</button></form></main>`})
export class InicioSesionComponent { usuario=''; contrasena=''; error=''; constructor(private api:ApiService,private router:Router){} ingresar(){this.api.iniciarSesion({usuario:this.usuario,contrasena:this.contrasena}).subscribe({next:r=>{sessionStorage.setItem('token',r.token);this.router.navigateByUrl('/usuarios')},error:e=>this.error=e.error?.error||'No fue posible ingresar'});}}
