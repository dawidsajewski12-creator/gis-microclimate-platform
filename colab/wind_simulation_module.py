# -*- coding: utf-8 -*-
"""
wind_simulation_module.py
Pełna logika LBM – wywoływana z notebooka Colab
"""

import numpy as np
from numba import njit, prange
import time

# -------------------------------------------------- LBM kernel
@njit(parallel=True, fastmath=True)
def _lbm(mask, wind_speed, wind_deg,
         nx, ny, max_iter, omega):
    c = np.array([[0,0],[1,0],[0,1],[-1,0],[0,-1],
                  [1,1],[-1,1],[-1,-1],[1,-1]],np.int64)
    w = np.array([4/9]+[1/9]*4+[1/36]*4)
    cx,cy = c[:,0], c[:,1]
    F  = np.ones((ny,nx,9))
    Fs = np.empty_like(F)
    rad=np.deg2rad(90-wind_deg)
    u0,v0 = 0.1*np.cos(rad), 0.1*np.sin(rad)
    rho = np.empty((ny,nx))
    ux  = np.zeros((ny,nx))
    uy  = np.zeros((ny,nx))
    for it in range(max_iter):
        # stream
        for j in prange(ny):
            for i in range(nx):
                for k in range(9):
                    Fs[j,i,k]=F[(j-cy[k])%ny,(i-cx[k])%nx,k]
        F,Fs = Fs,F
        # bounce-back
         for j in prange(ny):
             for i in range(nx):
                 if mask[j,i]:
                     # Numba-compatible bounce-back
                     tmp = F[j,i,1]
                     F[j,i,1] = F[j,i,3]
                     F[j,i,3] = tmp
         
                     tmp = F[j,i,2]
                     F[j,i,2] = F[j,i,4]
                     F[j,i,4] = tmp
         
                     tmp = F[j,i,5]
                     F[j,i,5] = F[j,i,7]
                     F[j,i,7] = tmp
         
                     tmp = F[j,i,6]
                     F[j,i,6] = F[j,i,8]
                     F[j,i,8] = tmp

        # macroscopic
        for j in prange(ny):
            for i in range(nx):
                s=F[j,i].sum()
                rho[j,i]=s
                ux[j,i]=(F[j,i]*cx).sum()/s
                uy[j,i]=(F[j,i]*cy).sum()/s
        # inlet
        if wind_deg<45 or wind_deg>=315:
            ux[0,:],uy[0,:]=u0,v0
        elif wind_deg<135:
            ux[:,-1],uy[:,-1]=u0,v0
        elif wind_deg<225:
            ux[-1,:],uy[-1,:]=u0,v0
        else:
            ux[:,0],uy[:,0]=u0,v0
        # collide
        for j in prange(ny):
            for i in range(nx):
                usq=ux[j,i]**2+uy[j,i]**2
                for k in range(9):
                    cu=ux[j,i]*cx[k]+uy[j,i]*cy[k]
                    feq=rho[j,i]*w[k]*(1+3*cu+4.5*cu**2-1.5*usq)
                    F[j,i,k]+=omega*(feq-F[j,i,k])
    # scale velocities
    scale=wind_speed/0.1
    return ux*scale, uy*scale

# -------------------------------------------------- public API
def run_wind_simulation(obstacle_mask, grid_info, weather_data, sim_params):
    """
    obstacle_mask : bool ndarray [ny, nx]
    grid_info     : dict (width,height)
    weather_data  : {'wind_speed_ms', 'wind_direction_deg'}
    sim_params    : dict (grid_width, buffer_size, max_iterations, relaxation_rate, ...)
    Returns dict with stats + vector_field + magnitude_grid
    """
    ny,nx = obstacle_mask.shape
    t0 = time.time()
    ux,uy = _lbm(obstacle_mask,
                 weather_data["wind_speed_ms"],
                 weather_data["wind_direction_deg"],
                 nx,ny,
                 sim_params["max_iterations"],
                 sim_params["relaxation_rate"])
    comp = time.time()-t0
    mag  = np.sqrt(ux**2+uy**2)
    buf  = sim_params["buffer_size"]
    core = mag[buf:-buf,buf:-buf] if buf else mag
    stats=dict(min_magnitude=float(core.min()),
               max_magnitude=float(core.max()),
               mean_magnitude=float(core.mean()),
               std_magnitude=float(core.std()))
    stride = sim_params["vector_stride"]
    vectors=[]
    for y in range(0,ny,stride):
        for x in range(0,nx,stride):
            if not obstacle_mask[y,x]:
                vectors.append(dict(x=x,y=y,
                                    vx=round(float(ux[y,x]),sim_params["output_precision"]),
                                    vy=round(float(uy[y,x]),sim_params["output_precision"]),
                                    magnitude=round(float(mag[y,x]),sim_params["output_precision"])))
    return dict(computation_time=round(comp,2),
                flow_statistics=stats,
                vector_field=vectors,
                magnitude_grid=mag.round(sim_params["output_precision"]).tolist())
