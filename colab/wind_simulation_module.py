# -*- coding: utf-8 -*-
"""
wind_simulation_module.py
────────────────────────────────────────────────────────────────────────────
Lattice-Boltzmann wind-flow solver (D2Q9) wykorzystywany przez notebook Colab.
Plik żyje w repozytorium „gis-microclimate-platform/colab” i jest
IMPORTOWANY z Colab → dzięki temu notebook pozostaje lekki, a całe
algorytmiczne „mięso” utrzymujemy w repozytorium.

API:
-----
run_wind_simulation(obstacle_mask, grid_info, weather_data, sim_params) → dict
• obstacle_mask : np.ndarray [ny, nx] - bool - True=obstacle
• grid_info     : {'width','height', ...}
• weather_data  : {'wind_speed_ms','wind_direction_deg'}
• sim_params    : dict  (max_iterations, relaxation_rate, vector_stride …)

Zwraca:
{
  'computation_time': float,
  'flow_statistics' : {...},
  'vector_field'    : [...],
  'magnitude_grid'  : [[...], ...]
}
"""

import numpy as np
import time
from numba import njit, prange


# ──────────────────────────────────────────────────────────────────────────
# LBM kernel (Numba JIT) – SINGLE-INDEX bounce-back (Numba-safe)
# ──────────────────────────────────────────────────────────────────────────
@njit(parallel=True, fastmath=True)
def _lbm(mask, wind_speed, wind_deg,
         nx, ny, max_iter, omega):
    """
    • mask      : bool[ny, nx]  True = obstacle (solid)
    • wind_speed: inlet speed  [m/s]   (physical)
    • wind_deg  : meteorological degrees (0°=N, 90°=E)
    • nx, ny    : grid size
    • max_iter  : iterations
    • omega     : relaxation rate (0-2)
    """
    # D2Q9 lattice
    c = np.array([[0, 0],
                  [1, 0], [0, 1], [-1, 0], [0, -1],
                  [1, 1], [-1, 1], [-1, -1], [1, -1]], dtype=np.int64)
    w = np.array([4/9,
                  1/9, 1/9, 1/9, 1/9,
                  1/36, 1/36, 1/36, 1/36], dtype=np.float64)

    cx, cy = c[:, 0], c[:, 1]

    # Distributions
    F  = np.ones((ny, nx, 9), dtype=np.float64)
    Fs = np.empty_like(F)

    # Inlet velocity (lattice units)
    rad = np.deg2rad(90.0 - wind_deg)          # meteo→math
    u0  = 0.1 * np.cos(rad)
    v0  = 0.1 * np.sin(rad)

    rho = np.empty((ny, nx), dtype=np.float64)
    ux  = np.zeros((ny, nx), dtype=np.float64)
    uy  = np.zeros((ny, nx), dtype=np.float64)

    for _ in range(max_iter):

        # 1) STREAMING  (periodic)
        for j in prange(ny):
            for i in range(nx):
                for k in range(9):
                    Fs[j, i, k] = F[(j - cy[k]) % ny, (i - cx[k]) % nx, k]

        F, Fs = Fs, F  # swap

        # 2) BOUNCE-BACK  (Numba-safe – bez list!)
        for j in prange(ny):
            for i in range(nx):
                if mask[j, i]:
                    # horizontal
                    temp = F[j, i, 1]; F[j, i, 1] = F[j, i, 3]; F[j, i, 3] = temp
                    # vertical
                    temp = F[j, i, 2]; F[j, i, 2] = F[j, i, 4]; F[j, i, 4] = temp
                    # diag 1
                    temp = F[j, i, 5]; F[j, i, 5] = F[j, i, 7]; F[j, i, 7] = temp
                    # diag 2
                    temp = F[j, i, 6]; F[j, i, 6] = F[j, i, 8]; F[j, i, 8] = temp

        # 3) OUTFLOW (simple copy)
        for i in range(nx):
            for k in range(9):
                F[0,     i, k] = F[1,     i, k]
                F[ny-1,  i, k] = F[ny-2,  i, k]
        for j in range(ny):
            for k in range(9):
                F[j, 0,     k] = F[j, 1,     k]
                F[j, nx-1,  k] = F[j, nx-2,  k]

        # 4) MACROSCOPIC variables
        for j in prange(ny):
            for i in range(nx):
                s_rho = 0.0
                s_ux  = 0.0
                s_uy  = 0.0
                for k in range(9):
                    f = F[j, i, k]
                    s_rho += f
                    s_ux  += f * cx[k]
                    s_uy  += f * cy[k]
                rho[j, i] = s_rho
                if s_rho > 1e-12:
                    ux[j, i] = s_ux / s_rho
                    uy[j, i] = s_uy / s_rho
                else:
                    ux[j, i] = 0.0
                    uy[j, i] = 0.0

        # 5) INFLOW (based on wind direction)
        if wind_deg >= 315 or wind_deg < 45:               # N
            ux[0, :],  uy[0, :]  = u0, v0
        elif wind_deg < 135:                               # E
            ux[:, -1], uy[:, -1] = u0, v0
        elif wind_deg < 225:                               # S
            ux[-1, :], uy[-1, :] = u0, v0
        else:                                              # W
            ux[:, 0],  uy[:, 0]  = u0, v0

        # 6) COLLISION (BGK)
        for j in prange(ny):
            for i in range(nx):
                usq = ux[j, i]**2 + uy[j, i]**2
                for k in range(9):
                    cu  = ux[j, i] * cx[k] + uy[j, i] * cy[k]
                    feq = rho[j, i] * w[k] * (1 + 3*cu + 4.5*cu**2 - 1.5*usq)
                    F[j, i, k] += omega * (feq - F[j, i, k])

    # scale to physical velocity
    scale = wind_speed / 0.1
    return ux * scale, uy * scale


# ──────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────────────────────────────────
def run_wind_simulation(obstacle_mask, grid_info, weather_data, sim_params):
    """
    High-level wrapper:
    obstacle_mask : bool ndarray (True=obstacle)
    grid_info     : {'width','height', ...}
    weather_data  : {'wind_speed_ms','wind_direction_deg'}
    sim_params    : dict with LBM parameters
    """
    ny, nx   = obstacle_mask.shape
    t0       = time.time()

    ux, uy   = _lbm(
        obstacle_mask,
        weather_data["wind_speed_ms"],
        weather_data["wind_direction_deg"],
        nx, ny,
        sim_params["max_iterations"],
        sim_params["relaxation_rate"],
    )

    comp_time = round(time.time() - t0, 2)
    mag       = np.sqrt(ux**2 + uy**2)

    buf  = sim_params["buffer_size"]
    core = mag[buf:-buf, buf:-buf] if buf else mag

    stats = dict(
        min_magnitude  = float(core.min()),
        max_magnitude  = float(core.max()),
        mean_magnitude = float(core.mean()),
        std_magnitude  = float(core.std()),
        median_magnitude = float(np.median(core)),
        percentile_95  = float(np.percentile(core, 95)),
        percentile_05  = float(np.percentile(core, 5)),
    )

    # vector field for visualisation
    stride   = sim_params["vector_stride"]
    vectors  = []
    prec     = sim_params["output_precision"]
    for y in range(0, ny, stride):
        for x in range(0, nx, stride):
            if not obstacle_mask[y, x]:
                vectors.append(dict(
                    x          = int(x),
                    y          = int(y),
                    vx         = round(float(ux[y, x]), prec),
                    vy         = round(float(uy[y, x]), prec),
                    magnitude  = round(float(mag[y, x]), prec)
                ))

    return dict(
        computation_time = comp_time,
        flow_statistics  = stats,
        vector_field     = vectors,
        magnitude_grid   = mag.round(prec).tolist(),
    )
