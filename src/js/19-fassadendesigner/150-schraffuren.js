/* Schraffuren für Fassadentypen (Fassadendesigner, 2D-Ansicht und LOD 200 in 3D).
   Muster sind Linienscharen wie im PAT-Format (AutoCAD/Revit): je Schar Winkel a (Grad), Ursprung x/y, Versatz dx
   (entlang der Linie) und dy (Abstand zur nächsten Linie) sowie Strich-/Lückenlängen d (positiv Strich, negativ Lücke,
   0 Punkt). Quellen: eigene Klinker-Verbände (SCH_KLINKER), mitgelieferte deutsche Muster (SCH_DE), eigene einfache Muster (Editor: Linien waagerecht,
   senkrecht, Kreuz, diagonal) und importierte .pat-Dateien (UTF-8 oder Latin-1). Eigene und importierte Muster liegen
   in S.sch (mit dem Projekt gespeichert und im Browser für neue Projekte gemerkt). Ein Fassadentyp verweist mit
   t.sch = { k, e, w, c } auf ein Muster: e Meter je Mustereinheit, w Drehung (Grad), c Linienfarbe.
   Dargestellt wird je Muster eine nahtlose Kachel (schKachel: kleinste Wiederholung in x und y), als Canvas für die
   2D-Ansicht und als Textur für den Shader in 3D (in Wandebene bzw. waagerecht auf Decken). */

/** Mitgelieferte deutsche Muster (PAT-Text). */
const SCH_DE =
  '*Boden\n-45,0,6,5.6569,5.6569,1.4142,-9.8995\n-45,0,8,5.6569,5.6569,2.8284,-8.4853\n-45,2,8,5.6569,5.6569,1.4142,-9.8995\n45,0,4,5.6569,5.6569,5.6569,-5.6569\n45,2,4,5.6569,5.6569,5.6569,-5.6569\n45,4,4,5.6569,5.6569,5.6569,-5.6569\n-45,7,7,5.6569,5.6569,1.4142,-9.8995\n*Beton_bewehrt\n45, 0,0, 0,.25\n45, .176776695,0, 0,.25, .125,-.0625\n*Beton_unbewehrt\n45, .176776695,0, 0,.25, .125,-.0625\n*Betonfertigteil1, WD\n45,0,0,0,1\n-45,0,0,0,1\n*Betonfertigteil2, ohne bes WD\n0,0,0,0,1\n90,0,0,0,1\n*DHart, Dämmung hart\n76, 0,0, 0, 0.9703\n284, 0,0, .5, 0.9703\n*Dichtstoffe\n45, 0,0, 0,.125\n135, 0,0, 0,.125\n*DvorOrt, Dämmung vor Ort ausgeschäumt\n45, 0, 0, 2.121320, 0.707107 , 0.176777, -1.237437\n45, 0.375, 0.875, 2.121320, 0.707107 , 0.176777, -1.237437\n45, 0.5, 0, 2.121320, 0.707107 , 0.176777, -1.237437\n45, 0.875, 0.875, 2.121320, 0.707107 , 0.176777, -1.237437\n71.565051, 0.125, 0.125, 4.110961, 0.316228 , 0.395285, -2.766993\n71.565051, 0.25, 0.5, 4.110961, 0.316228 , 0.395285, -2.766993\n71.565051, 0.625, 0.125, 4.110961, 0.316228 , 0.395285, -2.766993\n71.565051, 0.75, 0.5, 4.110961, 0.316228 , 0.395285, -2.766993\n135, 0.125, 0.875, -2.121320, 0.707107 , 0.176777, -1.237437\n135, 0.5, 0, -2.121320, 0.707107 , 0.176777, -1.237437\n135, 0.625, 0.875, -2.121320, 0.707107 , 0.176777, -1.237437\n135, 1, 0, -2.121320, 0.707107 , 0.176777, -1.237437\n108.434949, 0.25, 0.5, -4.110961, 0.316228 , 0.395285, -2.766993\n108.434949, 0.375, 0.125, -4.110961, 0.316228 , 0.395285, -2.766993\n108.434949, 0.75, 0.5, -4.110961, 0.316228 , 0.395285, -2.766993\n108.434949, 0.875, 0.125, -4.110961, 0.316228 , 0.395285, -2.766993\n*Dweich, Dämmung weich\n22.438445,  0.5, 0,       49.769468, 0.003742,   0.267232, -266.964877\n22.554215,  0.752, 0.897, 70.384657, 0.003724,   0.268539, -268.270099\n56.354176,  0.15, 0.35,   355.562934, 0.002784,  0.359168, -358.809316\n67.643109,  0.65, 0.649,  115.693561, 0.007458,  0.268157, -133.810179\n67.643109,  0.747, 0.102, 115.693561, 0.007458,  0.268157, -133.810179\n112.356891, 0.252, 0.102, -115.693561, 0.007458, 0.268157, -133.810179\n112.356891, 0.349, 0.649, -115.693561, 0.007458, 0.268157, -133.810179\n123.645824, 0.849, 0.35,  -355.562934, 0.002784, 0.359168, -358.809316\n157.363666, 0.247, 0.897, -254.615396, 0.003737, 0.267615, -267.347780\n157.643109, 0.5, 0,       -18.384775, 0.007458,  0.268157, -133.810179\n*Holz_laengs\n0,0,19,0,19,1,-37\n0,19,19,0,19,1,-37\n-14.036243,1,19,73.73083,18.432708,4.123106,-74.215901\n-14.036243,20,19,73.73083,18.432708,4.123106,-74.215901\n-14.036243,39,19,73.73083,18.432708,4.123106,-74.215901\n-14.036243,58,19,73.73083,18.432708,4.123106,-74.215901\n0,5,18,0,19,3,-16\n18.434949,8,18,6.008328,18.024983,3.162278,-56.920998\n18.434949,27,18,6.008328,18.024983,3.162278,-56.920998\n18.434949,46,18,6.008328,18.024983,3.162278,-56.920998\n0,11,19,0,19,1,-37\n0,30,19,0,19,1,-37\n-18.434949,12,19,54.074948,18.024983,3.162278,-56.920998\n-18.434949,31,19,54.074948,18.024983,3.162278,-56.920998\n-18.434949,50,19,54.074948,18.024983,3.162278,-56.920998\n0,15,18,0,19,1,-18\n18.434949,16,18,6.008328,18.024983,3.162278,-56.920998\n18.434949,35,18,6.008328,18.024983,3.162278,-56.920998\n18.434949,54,18,6.008328,18.024983,3.162278,-56.920998\n18.434949,0,13,6.008328,18.024983,3.162278,-56.920998\n18.434949,19,13,6.008328,18.024983,3.162278,-56.920998\n18.434949,38,13,6.008328,18.024983,3.162278,-56.920998\n0,3,14,0,19,1,-18\n-18.434949,4,14,54.074948,18.024983,3.162278,-56.920998\n-18.434949,23,14,54.074948,18.024983,3.162278,-56.920998\n-18.434949,42,14,54.074948,18.024983,3.162278,-56.920998\n0,7,13,0,19,2,-17\n18.434949,9,13,6.008328,18.024983,3.162278,-56.920998\n18.434949,28,13,6.008328,18.024983,3.162278,-56.920998\n18.434949,47,13,6.008328,18.024983,3.162278,-56.920998\n0,12,14,0,19,2,-17\n-18.434949,14,14,54.074948,18.024983,3.162278,-56.920998\n-18.434949,33,14,54.074948,18.024983,3.162278,-56.920998\n-18.434949,52,14,54.074948,18.024983,3.162278,-56.920998\n0,17,13,0,19,2,-17\n0,0,8,0,19,1,-18\n18.434949,1,8,6.008328,18.024983,3.162278,-56.920998\n18.434949,20,8,6.008328,18.024983,3.162278,-56.920998\n18.434949,39,8,6.008328,18.024983,3.162278,-56.920998\n0,4,9,0,19,2,-17\n-18.434949,6,9,54.074948,18.024983,3.162278,-56.920998\n-18.434949,25,9,54.074948,18.024983,3.162278,-56.920998\n-18.434949,44,9,54.074948,18.024983,3.162278,-56.920998\n0,9,8,0,19,2,-17\n18.434949,11,8,6.008328,18.024983,3.162278,-56.920998\n18.434949,30,8,6.008328,18.024983,3.162278,-56.920998\n18.434949,49,8,6.008328,18.024983,3.162278,-56.920998\n0,14,9,0,19,2,-17\n-18.434949,16,9,54.074948,18.024983,3.162278,-56.920998\n-18.434949,35,9,54.074948,18.024983,3.162278,-56.920998\n-18.434949,54,9,54.074948,18.024983,3.162278,-56.920998\n-18.434949,0,4,54.074948,18.024983,3.162278,-56.920998\n-18.434949,19,4,54.074948,18.024983,3.162278,-56.920998\n-18.434949,38,4,54.074948,18.024983,3.162278,-56.920998\n0,3,3,0,19,2,-17\n18.434949,5,3,6.008328,18.024983,3.162278,-56.920998\n18.434949,24,3,6.008328,18.024983,3.162278,-56.920998\n18.434949,43,3,6.008328,18.024983,3.162278,-56.920998\n0,8,4,0,19,1,-18\n-18.434949,9,4,54.074948,18.024983,3.162278,-56.920998\n-18.434949,28,4,54.074948,18.024983,3.162278,-56.920998\n-18.434949,47,4,54.074948,18.024983,3.162278,-56.920998\n0,12,3,0,19,3,-16\n18.434949,15,3,6.008328,18.024983,3.162278,-56.920998\n18.434949,34,3,6.008328,18.024983,3.162278,-56.920998\n18.434949,53,3,6.008328,18.024983,3.162278,-56.920998\n0,18,4,0,19,1,-18\n*Holz_quer\n26.565051,17,3,8.497058,16.994117,2.236068,-40.249224\n26.565051,36,3,8.497058,16.994117,2.236068,-40.249224\n45,16,2,13.435029,13.435029,1.414214,-25.455844\n63.434949,15,0,33.988233,16.994117,2.236068,-40.249224\n63.434949,15,19,33.988233,16.994117,2.236068,-40.249224\n21.801409,14,7,14.112846,35.282114,5.385165,-96.932966\n21.801409,14,26,14.112846,35.282114,5.385165,-96.932966\n21.801409,33,7,14.112846,35.282114,5.385165,-96.932966\n21.801409,33,26,14.112846,35.282114,5.385165,-96.932966\n21.801409,52,7,14.112846,35.282114,5.385165,-96.932966\n21.801409,52,26,14.112846,35.282114,5.385165,-96.932966\n21.801409,71,7,14.112846,35.282114,5.385165,-96.932966\n21.801409,71,26,14.112846,35.282114,5.385165,-96.932966\n21.801409,90,7,14.112846,35.282114,5.385165,-96.932966\n21.801409,90,26,14.112846,35.282114,5.385165,-96.932966\n45,12,5,13.435029,13.435029,2.828427,-24.041631\n68.198591,10,0,88.205286,35.282114,5.385165,-96.932966\n68.198591,10,19,88.205286,35.282114,5.385165,-96.932966\n68.198591,10,38,88.205286,35.282114,5.385165,-96.932966\n68.198591,10,57,88.205286,35.282114,5.385165,-96.932966\n68.198591,10,76,88.205286,35.282114,5.385165,-96.932966\n68.198591,29,0,88.205286,35.282114,5.385165,-96.932966\n68.198591,29,19,88.205286,35.282114,5.385165,-96.932966\n68.198591,29,38,88.205286,35.282114,5.385165,-96.932966\n68.198591,29,57,88.205286,35.282114,5.385165,-96.932966\n68.198591,29,76,88.205286,35.282114,5.385165,-96.932966\n14.036243,15,13,4.608177,18.432708,4.123106,-74.215901\n14.036243,34,13,4.608177,18.432708,4.123106,-74.215901\n14.036243,53,13,4.608177,18.432708,4.123106,-74.215901\n14.036243,72,13,4.608177,18.432708,4.123106,-74.215901\n26.565051,11,11,8.497058,16.994117,4.472136,-38.013156\n26.565051,30,11,8.497058,16.994117,4.472136,-38.013156\n45,8,8,13.435029,13.435029,4.242641,-22.627417\n63.434949,6,4,33.988233,16.994117,4.472136,-38.013156\n63.434949,6,23,33.988233,16.994117,4.472136,-38.013156\n75.963757,5,0,73.73083,18.432708,4.123106,-74.215901\n75.963757,5,19,73.73083,18.432708,4.123106,-74.215901\n75.963757,5,38,73.73083,18.432708,4.123106,-74.215901\n75.963757,5,57,73.73083,18.432708,4.123106,-74.215901\n11.309932,14,18,3.726207,18.631033,5.09902,-91.782351\n11.309932,33,18,3.726207,18.631033,5.09902,-91.782351\n11.309932,52,18,3.726207,18.631033,5.09902,-91.782351\n11.309932,71,18,3.726207,18.631033,5.09902,-91.782351\n11.309932,90,18,3.726207,18.631033,5.09902,-91.782351\n18.434949,11,17,6.008328,18.024983,3.162278,-56.920998\n18.434949,30,17,6.008328,18.024983,3.162278,-56.920998\n18.434949,49,17,6.008328,18.024983,3.162278,-56.920998\n33.690068,8,15,21.078607,31.617911,3.605551,-64.899923\n33.690068,8,34,21.078607,31.617911,3.605551,-64.899923\n33.690068,27,15,21.078607,31.617911,3.605551,-64.899923\n33.690068,27,34,21.078607,31.617911,3.605551,-64.899923\n33.690068,46,15,21.078607,31.617911,3.605551,-64.899923\n33.690068,46,34,21.078607,31.617911,3.605551,-64.899923\n45,4,11,13.435029,13.435029,5.656854,-21.213204\n56.309932,2,8,47.426867,31.617911,3.605551,-64.899923\n56.309932,2,27,47.426867,31.617911,3.605551,-64.899923\n56.309932,2,46,47.426867,31.617911,3.605551,-64.899923\n56.309932,21,8,47.426867,31.617911,3.605551,-64.899923\n56.309932,21,27,47.426867,31.617911,3.605551,-64.899923\n56.309932,21,46,47.426867,31.617911,3.605551,-64.899923\n71.565051,1,5,54.074948,18.024983,3.162278,-56.920998\n71.565051,1,24,54.074948,18.024983,3.162278,-56.920998\n71.565051,1,43,54.074948,18.024983,3.162278,-56.920998\n78.690068,0,0,93.155164,18.631033,5.09902,-91.782351\n78.690068,0,19,93.155164,18.631033,5.09902,-91.782351\n78.690068,0,38,93.155164,18.631033,5.09902,-91.782351\n78.690068,0,57,93.155164,18.631033,5.09902,-91.782351\n78.690068,0,76,93.155164,18.631033,5.09902,-91.782351\n45,0,14,13.435029,13.435029,7.071068,-19.79899\n*Holzkon2, Holzkonstruktion ungehobelt\n26.5651,0,0,0,0.8\n-26.5651,0,0,0,0.8\n*Kies\n228.0128, 0.720,1.000, 12.041365,0.074329, 0.134536,-13.319088\n184.9697, 0.630,0.900, -12.041517,0.043315, 0.230868,-22.855925\n132.5104, 0.400,0.880, -14.865942,0.061430, 0.162788,-16.116032\n267.2737, 0.010,0.630, -20.024928,0.047565, 0.210238,-20.813558\n292.8337, 0.000,0.420, -12.999910,0.048507, 0.206155,-20.409373\n357.2737, 0.080,0.230, -20.024928,0.047565, 0.210238,-20.813558\n37.6942, 0.290,0.220, -16.401180,0.035968, 0.278029,-27.524849\n72.2553, 0.510,0.390, 23.086761,0.038097, 0.262488,-25.986321\n121.4296, 0.590,0.640, 15.264264,0.047405, 0.210950,-20.884073\n175.2364, 0.480,0.820, -11.045049,0.083045, 0.240832,-11.800763\n222.3974, 0.240,0.840, 16.278789,0.032108, 0.311448,-30.833375\n138.8141, 1.000,0.620, 9.219065,0.094072, 0.106301,-10.523844\n171.4692, 0.920,0.690, -13.152853,0.049447, 0.202237,-20.021511\n225.0000, 0.720,0.720, 0.707107,0.707107, 0.141421,-1.272792\n203.1986, 0.650,0.840, -5.383564,0.131306, 0.076158,-7.539615\n291.8014, 0.580,0.810, -3.156821,0.185695, 0.107703,-5.277462\n30.9638, 0.620,0.710, 3.601470,0.171499, 0.174929,-5.656023\n161.5651, 0.770,0.800, -2.213594,0.316228, 0.126491,-3.035787\n16.3895, 0.000,0.810, 10.440154,0.056433, 0.177200,-17.542845\n70.3462, 0.170,0.860, -11.704507,0.067267, 0.148661,-14.717408\n293.1986, 0.770,1.000, -5.383564,0.131306, 0.152315,-7.463458\n343.6105, 0.830,0.860, -10.440154,0.056433, 0.177200,-17.542845\n339.4440, 0.000,0.190, -5.383893,0.117041, 0.170880,-8.373124\n294.7751, 0.160,0.130, -12.082844,0.069843, 0.143178,-14.174643\n66.8014, 0.780,0.000, 5.383564,0.131306, 0.152315,-7.463458\n17.3540, 0.840,0.140, -13.601340,0.059655, 0.167631,-16.595424\n69.4440, 0.290,0.000, -5.383893,0.117041, 0.085440,-8.458564\n101.3099, 0.720,0.000, 4.118439,0.196116, 0.050990,-5.048029\n165.9638, 0.710,0.050, -3.152963,0.242536, 0.206155,-3.916950\n186.0090, 0.510,0.100, -10.049739,0.052342, 0.191050,-18.913923\n303.6901, 0.620,0.620, -2.218801,0.277350, 0.144222,-3.461329\n353.1572, 0.700,0.500, 17.117197,0.039715, 0.251794,-24.927563\n60.9454, 0.950,0.470, -8.061673,0.097129, 0.102956,-10.192674\n90.0000, 1.000,0.560, 1.000,1.000, 0.060000,-0.940\n120.2564, 0.490,0.130, -8.061936,0.071982, 0.138924,-13.753520\n48.0128, 0.420,0.250, 12.041365,0.074329, 0.269072,-13.184552\n0.0000, 0.600,0.450, 1.000,1.000, 0.260000,-0.740\n325.3048, 0.860,0.450, -12.206392,0.063246, 0.158114,-15.653274\n254.0546, 0.990,0.360, 4.120817,0.137361, 0.145602,-7.134508\n207.6460, 0.950,0.220, 21.470869,0.042182, 0.237065,-23.469474\n175.4261, 0.740,0.110, 13.038344,0.039873, 0.250799,-24.829074\n*Sand\n37.5,   0,0,       1.123,1.567,                  0,-1.52,0,-1.7,0,-1.625\n7.5,    0,0,       2.123,2.567,                  0,-.82,0,-1.37,0,-.525\n-32.5, -1.23,0,    2.6234,1.678,                 0,-.5,0,-1.8,0,-2.35\n-42.5, -1.23,0,    1.6234,2.678,                 0,-.25,0,-1.18,0,-1.35\n*Mauerwerk\n45, 0,0, 0,.125\n*Moertel\n0, 0.040,0.020, 0,1, 0,-1\n0, 0.360,0.040, 0,1, 0,-1\n0, 0.180,0.260, 0,1, 0,-1\n0, 0.400,0.420, 0,1, 0,-1\n0, 0.140,0.480, 0,1, 0,-1\n0, 0.220,0.720, 0,1, 0,-1\n0, 0.080,0.900, 0,1, 0,-1\n0, 0.400,0.880, 0,1, 0,-1\n0, 0.640,0.920, 0,1, 0,-1\n0, 0.760,0.680, 0,1, 0,-1\n0, 0.960,0.660, 0,1, 0,-1\n0, 0.960,0.300, 0,1, 0,-1\n0, 0.780,0.180, 0,1, 0,-1\n0, 0.500,0.240, 0,1, 0,-1\n0, 0.680,0.420, 0,1, 0,-1\n0, 0.500,0.600, 0,1, 0,-1\n0, 0.920,0.040, 0,1, 0,-1\n*MW_Schuettgut1,Plattenschalung oder Schalungsteine\n45, 0, 0, 0, 1 \n45, 0.7071, 0, 0, 1, 0, -0.5\n*MW_Schuettgut2,ohne besondere Wärmedämmeigenschaft unbewehrt\n45, 0.5, 0, 0, 1, 0.5, -0.5\n*MW_Schuettgut3,ohne besondere Wärmedämmeigenschaft\n45, 0, 0, 0, 1 \n45, 0.7071, 0, 0, 1, 0.5, -0.5\n*MW_Stueckgut1,Ziegel Hohlziegel Leichtbeton\n45, 0, 0, 0, 1\n*MW_Stueckgut2, Gipsdielen Dünnwandsteine Sichtziegel\n45,0,0,0,1\n45,0.3,0,0,1\n*Punkte1,Punktreihe Abstand 1\n0, 0, 0, 0.5, 1, 0, -1\n*Punkte2,Punktreihe Abstand 1 Versatz 1\n0, 0, 0, 1, 1, 0, -1';
/**
 * Eigene Klinker-Verbände in der Ansicht (maad, frei verwendbar): Normalformat NF 240 × 71 mm mit Fugen, also
 * Modul 250 mm × 83,33 mm (3 Schichten = 25 cm), Einheit Millimeter. Waagerecht die Lagerfugen, senkrecht die
 * Stoßfugen je Schicht (Strich = eine Schicht, Lücke = übersprungene Schichten).
 */
const SCH_KLINKER = `*Klinker Läuferverband NF, Stoßfugen je Schicht um 1/2 Stein versetzt
0, 0,0, 0,83.333
90, 0,0, 83.333,125, 83.333,-83.333
*Klinker Blockverband NF, Läufer- und Binderschichten im Wechsel
0, 0,0, 0,83.333
90, 0,0, 0,250, 83.333,-83.333
90, 62.5,83.333, 0,125, 83.333,-83.333
*Klinker Kreuzverband NF, wie Blockverband, jede zweite Läuferschicht um 1/2 Stein versetzt
0, 0,0, 0,83.333
90, 0,0, 0,250, 83.333,-250
90, 125,166.667, 0,250, 83.333,-250
90, 62.5,83.333, 0,125, 83.333,-83.333
*Klinker Läuferverband DF, Dünnformat 240 × 52 mm (Schicht 62,5 mm)
0, 0,0, 0,62.5
90, 0,0, 62.5,125, 62.5,-62.5`;
/** Arten der einfachen Muster (Editor). */
const SCH_EINFACH = {
  h: 'Linien waagerecht',
  v: 'Linien senkrecht',
  x: 'Kreuz',
  d: 'diagonal',
  dx: 'Diagonalkreuz',
};
S.sch = []; // eigene und importierte Muster: { k, n, b, L, q: 'eigen' | 'pat', ein? }
const SCH = { de: null, cache: new Map() };

/**
 * PAT-Text lesen: Muster ab „*Name, Beschreibung“, darunter je Zeile eine Linienschar „a, x, y, dx, dy [, d…]“.
 * Kommentare (;) und leere Zeilen werden übersprungen. Ergebnis: [{ n, b, L: [{ a, x, y, dx, dy, d }] }]
 */
function schParse(text) {
  const R = [];
  let cur = null;
  String(text || '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((z) => {
      const s = z.replace(/;.*$/, '').trim();
      if (!s) return;
      if (s[0] === '*') {
        const i = s.indexOf(','),
          n = (i < 0 ? s.slice(1) : s.slice(1, i)).trim(),
          b = i < 0 ? '' : s.slice(i + 1).trim();
        cur = { n: n || 'Muster', b, L: [] };
        R.push(cur);
        return;
      }
      if (!cur) return;
      const v = s.split(',').map((x) => +x.trim());
      if (v.length < 5 || v.slice(0, 5).some((x) => !isFinite(x))) return;
      cur.L.push({ a: v[0], x: v[1], y: v[2], dx: v[3], dy: v[4], d: v.slice(5).filter((x) => isFinite(x)) });
    });
  // Muster ohne Linien (z. B. *SOLID) entfallen
  return R.filter((p) => p.L.length);
}
/** Datei lesen: UTF-8, sonst Latin-1 (deutsche Muster aus älteren CAD-Programmen). */
function schDekodieren(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    logErr(e, 'schDekodieren');
    return new TextDecoder('latin1').decode(buf);
  }
}
/** Einfaches Muster (Editor) als Linienscharen in Metern: ah/av Abstand (m) der waagerechten/senkrechten Linien. */
function schEinfachLinien(p) {
  const ah = Math.max(0.005, +p.ah || 0.1),
    av = Math.max(0.005, +p.av || 0.1),
    L = [];
  if (p.art === 'h' || p.art === 'x') L.push({ a: 0, x: 0, y: 0, dx: 0, dy: ah, d: [] });
  if (p.art === 'v' || p.art === 'x') L.push({ a: 90, x: 0, y: 0, dx: 0, dy: av, d: [] });
  if (p.art === 'd' || p.art === 'dx') L.push({ a: 45, x: 0, y: 0, dx: 0, dy: ah, d: [] });
  if (p.art === 'dx') L.push({ a: 135, x: 0, y: 0, dx: 0, dy: av, d: [] });
  return L;
}
/**
 * Maßstab der deutschen Muster in der Ansicht (e Meter je Mustereinheit, wie beim Klinker fest statt geschätzt): die
 * Linien liegen etwa 8–15 cm auseinander, Strichstärke 6 mm – so bleiben sie auch aus der Entfernung klar statt zu
 * einem grauen Schleier zu verschwimmen.
 */
const SCH_DE_MASS = {
  Boden: { e: 0.025 },
  Beton_bewehrt: { e: 0.5 },
  Beton_unbewehrt: { e: 0.5 },
  Betonfertigteil1: { e: 0.15 },
  Betonfertigteil2: { e: 0.25 },
  DHart: { e: 0.15 },
  Dichtstoffe: { e: 1 },
  DvorOrt: { e: 0.4 },
  Dweich: { e: 0.3 },
  Holz_laengs: { e: 0.006 },
  Holz_quer: { e: 0.006 },
  Holzkon2: { e: 0.15 },
  Kies: { e: 0.6 },
  Sand: { e: 0.08 },
  Mauerwerk: { e: 1 },
  Moertel: { e: 0.3 },
  MW_Schuettgut1: { e: 0.12 },
  MW_Schuettgut2: { e: 0.12 },
  MW_Schuettgut3: { e: 0.12 },
  MW_Stueckgut1: { e: 0.12 },
  MW_Stueckgut2: { e: 0.12 },
  Punkte1: { e: 0.1, lw: 0.012 },
  Punkte2: { e: 0.15, lw: 0.012 },
};
/** Alle wählbaren Muster: mitgelieferte (de:Name), eigene und importierte (S.sch). */
function schAlle() {
  if (!SCH.de)
    SCH.de = schParse(SCH_KLINKER)
      .map((p) => ({ ...p, k: 'de:' + p.n, q: 'de', e: 0.001, lw: 0.008 })) // Klinker: Millimeter, Fuge ~8 mm
      .concat(
        schParse(SCH_DE).map((p) => ({
          ...p,
          k: 'de:' + p.n,
          q: 'de',
          lw: 0.006,
          ...(SCH_DE_MASS[p.n] || {}),
        })),
      );
  return SCH.de.concat(S.sch);
}
const schG = (k) => (k ? schAlle().find((p) => p.k === k) || null : null);
/** Linien eines Musters (einfache Muster aus ihren Einstellungen). */
const schLinien = (P) => (P.ein ? schEinfachLinien(P.ein) : P.L);

/**
 * Kleinste Wiederholung (Kachel W × H in Mustereinheiten): (W, 0) und (0, H) müssen für jede Linienschar eine
 * Verschiebung auf sich selbst sein (Vielfaches von dy quer, Rest entlang der Linie Vielfaches der Strichlänge).
 * Ohne genaue Wiederholung (z. B. Kies mit schiefen Winkeln): eine große Kachel (kleine Nähte).
 */
function schKachel(L) {
  const fam = L.map((f) => {
      const a = (f.a * Math.PI) / 180,
        u = [Math.cos(a), Math.sin(a)],
        p = [-Math.sin(a), Math.cos(a)],
        per = f.d && f.d.length ? f.d.reduce((s, x) => s + Math.abs(x), 0) : 0;
      return { u, p, dx: f.dx, dy: f.dy, per };
    }),
    tol = 1e-3,
    ganz = (x) => Math.abs(x - Math.round(x)) < tol,
    passt = (T) =>
      fam.every((f) => {
        const q = T[0] * f.p[0] + T[1] * f.p[1],
          s = T[0] * f.u[0] + T[1] * f.u[1];
        let n = 0;
        if (Math.abs(f.dy) < 1e-9) {
          if (Math.abs(q) > tol) return false;
        } else {
          n = q / f.dy;
          if (!ganz(n)) return false;
          n = Math.round(n);
        }
        if (!f.per) return true;
        return ganz((s - n * f.dx) / f.per);
      }),
    kand = (ax) => {
      const C = new Set();
      fam.forEach((f) => {
        const sp = Math.abs(ax ? f.p[1] : f.p[0]),
          su = Math.abs(ax ? f.u[1] : f.u[0]);
        for (let k = 1; k <= 64; k++) {
          if (sp > 1e-6 && Math.abs(f.dy) > 1e-9) C.add(+((k * Math.abs(f.dy)) / sp).toFixed(6));
          if (su > 1e-6 && f.per) C.add(+((k * f.per) / su).toFixed(6));
          if (f.per) C.add(+(k * f.per).toFixed(6));
          if (Math.abs(f.dy) > 1e-9) C.add(+(k * Math.abs(f.dy)).toFixed(6));
        }
      });
      return [...C].filter((x) => x > 1e-4).sort((a, b) => a - b);
    },
    gross = Math.max(1, ...fam.map((f) => Math.max(Math.abs(f.dy), f.per))) * 8,
    W = kand(0).find((x) => x < 400 && passt([x, 0])) || gross,
    H = kand(1).find((x) => x < 400 && passt([0, x])) || gross;
  return { W, H };
}
/** Vorgabe für Meter je Mustereinheit: die Kachel wird etwa 20 cm groß (glatter Wert). */
function schStdE(P) {
  const { W, H } = schKachel(schLinien(P)),
    roh = 0.2 / Math.max(W, H, 1e-6),
    R = [0.0005, 0.001, 0.002, 0.0025, 0.005, 0.01, 0.0254, 0.05, 0.1, 0.2, 0.3048, 0.5, 1];
  return R.reduce((b, x) => (Math.abs(Math.log(x / roh)) < Math.abs(Math.log(b / roh)) ? x : b), R[0]);
}
/**
 * Kachel als Canvas (transparent, Linien in Farbe c): Muster P, e Meter je Einheit (Linienstärke etwa 4 mm in der
 * Wirklichkeit). Ergebnis { cv, Wm, Hm } (Größe der Kachel in Metern), zwischengespeichert.
 */
function schCanvas(P, e, c, pxm) {
  const L = schLinien(P),
    key = JSON.stringify([L, e, c, pxm || 0, P.lw || 0]);
  if (SCH.cache.has(key)) return SCH.cache.get(key);
  const { W, H } = schKachel(L),
    // pxm: Bildpunkte je Meter (2D-Ansicht: Kachel in Bildschirmauflösung, kein Moiré); sonst feste Auflösung (Textur)
    pxu = pxm ? pxm * e : Math.min(1024 / W, 1024 / H, 512 / Math.min(W, H)),
    cw = Math.max(8, Math.round(W * pxu)),
    ch = Math.max(8, Math.round(H * pxu)),
    kx = cw / W,
    ky = ch / H,
    cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const g = cv.getContext('2d');
  g.strokeStyle = g.fillStyle = c || '#3a3a3a';
  // Linienstärke in der Wirklichkeit: P.lw (z. B. Klinkerfuge), sonst 4 mm
  g.lineWidth = pxm
    ? Math.max(1, Math.min(3, (P.lw || 0) * pxm))
    : Math.max(1.2, Math.min(10, ((P.lw || 0.004) / Math.max(e, 1e-6)) * kx));
  g.lineCap = 'butt';
  // Bereich −W…2W × −H…2H zeichnen (nahtlos, da W/H die Wiederholung ist), Mustern y nach oben
  const P0 = (x, y) => [x * kx, (H - y) * ky],
    lin = (a, b) => {
      const [x0, y0] = P0(a[0], a[1]),
        [x1, y1] = P0(b[0], b[1]);
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
    },
    ecken = [
      [-W, -H],
      [2 * W, -H],
      [2 * W, 2 * H],
      [-W, 2 * H],
    ];
  g.beginPath();
  let n = 0;
  L.forEach((f) => {
    const a = (f.a * Math.PI) / 180,
      u = [Math.cos(a), Math.sin(a)],
      p = [-Math.sin(a), Math.cos(a)],
      q0 = f.x * p[0] + f.y * p[1],
      qs = ecken.map((c2) => c2[0] * p[0] + c2[1] * p[1]),
      per = f.d && f.d.length ? f.d.reduce((s, x) => s + Math.abs(x), 0) : 0,
      [k0, k1] =
        Math.abs(f.dy) < 1e-9
          ? [0, 0]
          : [
              Math.ceil((Math.min(...qs) - q0) / f.dy - 1e-9),
              Math.floor((Math.max(...qs) - q0) / f.dy + 1e-9),
            ].sort((x, y) => x - y);
    for (let k = k0; k <= k1 && n < 6000; k++, n++) {
      const B = [f.x + k * (f.dx * u[0] + f.dy * p[0]), f.y + k * (f.dx * u[1] + f.dy * p[1])],
        ss = ecken.map((c2) => (c2[0] - B[0]) * u[0] + (c2[1] - B[1]) * u[1]),
        s0 = Math.min(...ss),
        s1 = Math.max(...ss),
        Q = (s) => [B[0] + u[0] * s, B[1] + u[1] * s];
      if (!per) {
        lin(Q(s0), Q(s1));
        continue;
      }
      // Striche ab dem Linienursprung wiederholen
      for (let s = Math.floor(s0 / per) * per; s < s1; s += per)
        f.d.forEach((d) => {
          const l = Math.abs(d);
          if (d > 0) lin(Q(s), Q(s + l));
          else if (d === 0) {
            const [x0, y0] = P0(...Q(s));
            g.moveTo(x0 + 0.8, y0);
            g.arc(x0, y0, Math.max(0.8, g.lineWidth * 0.7), 0, 7);
          }
          s += l;
        });
    }
  });
  g.stroke();
  const o = { cv, Wm: W * e, Hm: H * e };
  if (SCH.cache.size > 200) SCH.cache.clear();
  SCH.cache.set(key, o);
  return o;
}
/** Schraffur eines Fassadentyps (aufgelöst) oder null: { P, e, w (Grad), c }. */
function schVonTyp(t) {
  const s = t && t.sch,
    P = s && schG(s.k);
  if (!P) return null;
  return {
    P,
    e: +s.e > 0 ? +s.e : P.e || schStdE(P),
    w: +s.w || 0,
    c: /^#[0-9a-f]{6}$/i.test(s.c || '') ? s.c : '#2f3337',
  };
}
/**
 * Fläche in der 2D-Ansicht schraffieren (nach dem Füllen, Pfad muss gesetzt sein): Muster in Ansichtsmaß (s = Pixel je
 * Meter), Ursprung bei Ansichtskoordinate 0/0 (Bildpunkt ox, oy).
 */
function schFuellen2D(g, t, s, ox, oy, regel) {
  const H = schVonTyp(t);
  if (!H) return;
  try {
    // Abstand der Linien auf dem Bildschirm: zu dicht (unter 3 px) wird in dieser Zoomstufe nicht schraffiert
    const L = schLinien(H.P),
      dmin = Math.min(...L.map((f) => (Math.abs(f.dy) > 1e-9 ? Math.abs(f.dy) : 1e9))) * H.e * s;
    if (!(dmin >= 3)) return;
    // Bildpunkte je Meter gestuft (weniger Neuberechnungen beim Zoomen)
    const pxm = Math.pow(1.15, Math.round(Math.log(s) / Math.log(1.15))),
      K = schCanvas(H.P, H.e, H.c, pxm),
      pat = g.createPattern(K.cv, 'repeat'),
      k = (s * K.Wm) / K.cv.width;
    pat.setTransform(
      new DOMMatrix()
        .translate(ox, oy)
        .rotate(-H.w)
        .scale(k, (s * K.Hm) / K.cv.height)
        .translate(0, -K.cv.height),
    );
    g.save();
    g.fillStyle = pat;
    g.fill(regel || 'nonzero');
    g.restore();
  } catch (e) {
    logErr(e, 'schFuellen2D');
  }
}
/** Textur einer Schraffur (Kachel, nahtlos wiederholt). */
function schTextur(H) {
  const K = schCanvas(H.P, H.e, H.c);
  if (!K.tex) {
    K.tex = new T.CanvasTexture(K.cv);
    K.tex.wrapS = K.tex.wrapT = T.RepeatWrapping;
    K.tex.anisotropy =
      (ren.capabilities && ren.capabilities.getMaxAnisotropy && ren.capabilities.getMaxAnisotropy()) || 1;
    K.tex.colorSpace = T.SRGBColorSpace || K.tex.colorSpace;
  }
  return K;
}
/** Schraffur in 3D erst ab dieser Nähe (m Abstand zur Kamera) einblenden, weich über die letzten 5 m – aus der Ferne
    würde das Bild sonst zu unruhig. */
const SCH_NAH = 40;
/** Höchstzahl der Linienscharen bzw. Striche je Schar für die genaue Darstellung im Shader (sonst Bild-Kachel). */
const SCH_MAXF = 128,
  SCH_MAXD = 8;
/**
 * Linienscharen als Datentextur für den Shader (4 Texel je Schar, in Metern): [cos, sin, x0, y0], [dx, dy, Periode,
 * Anzahl Striche], Striche 1–4, Striche 5–8. Null, wenn das Muster zu groß ist.
 */
function schDaten(H) {
  const L = schLinien(H.P);
  if (!L.length || L.length > SCH_MAXF || L.some((f) => (f.d || []).length > SCH_MAXD)) return null;
  const key = JSON.stringify([L, H.e]);
  if (SCH.cache.has('dat' + key)) return SCH.cache.get('dat' + key);
  const A = new Float32Array(L.length * 20);
  L.forEach((f, i) => {
    const a = (f.a * Math.PI) / 180,
      d = (f.d || []).map((x) => x * H.e),
      o = i * 20,
      P = d.reduce((s2, x) => s2 + Math.abs(x), 0);
    A.set([Math.cos(a), Math.sin(a), f.x * H.e, f.y * H.e], o);
    A.set([f.dx * H.e, f.dy * H.e, P, d.length], o + 4);
    d.forEach((x, j) => (A[o + 8 + j] = x));
    const G = schGitter(f.dx * H.e, f.dy * H.e, P, d);
    if (G) A.set(G, o + 16);
  });
  const tex = new T.DataTexture(A, 5, L.length, T.RGBAFormat, T.FloatType);
  tex.magFilter = tex.minFilter = T.NearestFilter;
  tex.needsUpdate = true;
  const r = { tex, n: L.length };
  SCH.cache.set('dat' + key, r);
  return r;
}
/**
 * Gitter einer gestrichelten Schar (Striche liegen auf dem Gitter m·(P, 0) + n·(dx, dy) in Linienrichtung s / quer q):
 * reduzierte Basis [e1s, e1q, e2s, e2q], wenn die Linien viel dichter liegen als die Striche lang sind (z. B. Dämmung
 * weich: 1 mm Linienabstand, Striche alle 80 m) – dann sucht der Shader die nächsten Gitterpunkte statt der nächsten
 * Linie. Sonst null (gewöhnliche Schar).
 */
function schGitter(dx, dy, P, d) {
  if (!(P > 1e-9) || !(Math.abs(dy) > 1e-9) || P / Math.abs(dy) < 6) return null;
  let a = [P, 0],
    b = [dx, dy];
  const n2 = (v) => v[0] * v[0] + v[1] * v[1];
  for (let k = 0; k < 64; k++) {
    if (n2(a) > n2(b)) [a, b] = [b, a];
    const mu = Math.round((a[0] * b[0] + a[1] * b[1]) / n2(a));
    if (!mu) break;
    b = [b[0] - mu * a[0], b[1] - mu * a[1]];
  }
  // längster Strich muss kürzer als die kleinere Gitterweite sein (sonst reichen die Nachbarpunkte nicht)
  const lmax = Math.max(0, ...d.filter((x) => x >= 0));
  return lmax < 0.95 * Math.sqrt(n2(a)) ? [a[0], a[1], b[0], b[1]] : null;
}
/** GLSL: Deckung der Musterlinien an der Stelle uv (Meter, in Wandebene) – genau je Linie, kantengeglättet. */
const SCH_GLSL = `float schDeckung(vec2 uv){
  float cov=0.;
  for(int i=0;i<${SCH_MAXF};i++){
    if(i>=uSchN)break;
    vec4 a=texelFetch(tSchP,ivec2(0,i),0),b=texelFetch(tSchP,ivec2(1,i),0);
    vec2 u=a.xy,pp=vec2(-u.y,u.x),d=uv-a.zw;
    float s=dot(d,u),q=dot(d,pp),k=abs(b.y)>1e-6?floor(q/b.y+.5):0.;
    vec4 gt=texelFetch(tSchP,ivec2(4,i),0);
    if(dot(gt.xy,gt.xy)>1e-12){
      // gestrichelte Schar mit sehr dichten Linien: nächste Gitterpunkte (reduzierte Basis gt) und ihre Striche
      vec2 e1=gt.xy,e2=gt.zw;float det=e1.x*e2.y-e1.y*e2.x;
      mat2 Bi=mat2(e2.y,-e1.y,-e2.x,e1.x)/det;
      float fp=max(max(fwidth(s),fwidth(q)),1e-6),hw2=max(uSchW,fp*.6),cg=0.,acc=0.,an=0.;
      for(int j=0;j<8;j++){
        if(float(j)>=b.w)break;
        float l=texelFetch(tSchP,ivec2(2+j/4,i),0)[j-4*(j/4)],al=abs(l);
        if(l>=0.){
          vec2 pj=vec2(s-acc,q),c0=floor(Bi*pj);
          for(int gx=-1;gx<=1;gx++)for(int gy=-1;gy<=1;gy++){
            vec2 L=(c0.x+float(gx))*e1+(c0.y+float(gy))*e2,dd=pj-L;
            float di=length(vec2(dd.x-clamp(dd.x,0.,al),dd.y));
            cg=max(cg,1.-smoothstep(hw2-fp*.5,hw2+fp*.5,di));
          }
          an+=max(al,2.*uSchW)*2.*uSchW;
        }
        acc+=al;
      }
      float r1=min(length(e1),length(e2));
      cg=mix(cg,min(1.,an/abs(det)),smoothstep(r1*.33,r1*.6,fp));
      cov=max(cov,cg);
      continue;
    }
    float dist=abs(q-k*b.y),fq=max(fwidth(q),1e-6),hw=max(uSchW,fq*.6);
    float c=1.-smoothstep(hw-fq*.5,hw+fq*.5,dist);
    if(b.z>1e-6){
      vec4 d0=texelFetch(tSchP,ivec2(2,i),0),d1=texelFetch(tSchP,ivec2(3,i),0);
      float D[8]=float[8](d0.x,d0.y,d0.z,d0.w,d1.x,d1.y,d1.z,d1.w);
      float m=mod(s-k*b.x,b.z),fs=max(fwidth(s),1e-6),acc=0.,on=0.;
      for(int j=0;j<8;j++){
        if(float(j)>=b.w)break;
        float l=D[j],al=abs(l);
        if(l>=0.){
          float lo=acc-(al<1e-6?hw:0.),hi=acc+al+(al<1e-6?hw:0.);
          on=max(on,smoothstep(lo-fs*.5,lo+fs*.5,m)*(1.-smoothstep(hi-fs*.5,hi+fs*.5,m)));
          on=max(on,smoothstep(lo-fs*.5,lo+fs*.5,m+b.z)*(1.-smoothstep(hi-fs*.5,hi+fs*.5,m+b.z)));
        }
        acc+=al;
      }
      c*=on;
    }
    // zu dichte Scharen (Abstand unter etwa 3 Bildpunkten): statt zu flimmern oder zu verschwinden in den mittleren
    // Grauwert der Schar übergehen (Strichbreite / Abstand), wie eine gedruckte Schraffur aus der Entfernung
    if(abs(b.y)>1e-6){
      float ton=min(1.,2.*uSchW/abs(b.y));
      if(b.z>1e-6){float an=0.;for(int j=0;j<8;j++){if(float(j)>=b.w)break;float l=(j<4?texelFetch(tSchP,ivec2(2,i),0)[j]:texelFetch(tSchP,ivec2(3,i),0)[j-4]);an+=l>=0.?max(l,2.*uSchW):0.;}ton*=min(1.,an/b.z);}
      c=mix(c,ton,smoothstep(abs(b.y)*.33,abs(b.y)*.6,fq));
    }
    cov=max(cov,c);
  }
  return cov;
}`;
/**
 * Material mit der Schraffur eines Fassadentyps versehen (3D): Linien in Wandebene (waagerecht auf Decken), Drehung w.
 * Genau im Shader gerechnet (schDeckung, scharf in jedem Abstand); sehr große Muster als Bild-Kachel. nurLinien: nur
 * die Linien zeichnen (Schicht vor der eingefärbten Wand), waagerechte Flächen ohne Schraffur.
 */
/** Schraffuren zeigen (1) oder nicht (0, Weißmodell) – gemeinsamer Wert aller Schraffur-Materialien (ftWmFarben). */
const SCH_AN = { value: 1 };
function schMaterial(m, t, nurLinien) {
  const H = schVonTyp(t);
  if (!H) return m;
  const D = schDaten(H),
    K = D ? null : schTextur(H),
    col = new T.Color(H.c),
    uni = D
      ? {
          tSchP: { value: D.tex },
          uSchN: { value: D.n },
          uSchW: { value: (H.P.lw || 0.004) / 2 },
          uSchC: { value: new T.Vector3(col.r, col.g, col.b) },
          uSchR: { value: (H.w * Math.PI) / 180 },
          uSchAn: SCH_AN,
        }
      : {
          tSch: { value: K.tex },
          uSchM: { value: new T.Vector2(K.Wm, K.Hm) },
          uSchR: { value: (H.w * Math.PI) / 180 },
          uSchAn: SCH_AN,
        },
    linie = D ? 'float hc=schDeckung(uv);vec4 hs=vec4(uSchC,hc);' : 'vec4 hs=texture2D(tSch,uv/uSchM);',
    kopf = D
      ? 'uniform highp sampler2D tSchP;uniform int uSchN;uniform float uSchW;uniform vec3 uSchC;uniform float uSchR;uniform float uSchAn;\n' +
        SCH_GLSL
      : 'uniform sampler2D tSch;uniform vec2 uSchM;uniform float uSchR;uniform float uSchAn;';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader =
      'varying vec3 vSchP;varying vec3 vSchN;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        // Normale aus der Geometrie (exakt je Fläche) – aus Bildschirm-Ableitungen schwankte die Richtung entlang der
        // Wand je Bildpunkt, senkrechte Linien zerfielen in Punkte
        '#include <begin_vertex>\nvSchP=(modelMatrix*vec4(transformed,1.0)).xyz;vSchN=normalize(mat3(modelMatrix)*objectNormal);',
      );
    sh.fragmentShader =
      'varying vec3 vSchP;varying vec3 vSchN;\n' +
      kopf +
      '\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{vec3 wn=normalize(vSchN);vec2 uv;
if(abs(wn.y)>.7){uv=vSchP.xz;}else{vec2 tt=normalize(vec2(-wn.z,wn.x));uv=vec2(dot(vSchP.xz,tt),vSchP.y);}
float cr=cos(uSchR),sr=sin(uSchR);uv=vec2(cr*uv.x+sr*uv.y,-sr*uv.x+cr*uv.y);
${linie}hs.a*=uSchAn*(1.-smoothstep(${SCH_NAH - 5}.,${SCH_NAH}.,distance(vSchP,cameraPosition)));${
          nurLinien
            ? 'if(hs.a<.02||abs(wn.y)>.7)discard;diffuseColor=vec4(hs.rgb,hs.a);'
            : 'diffuseColor.rgb=mix(diffuseColor.rgb,hs.rgb,hs.a);'
        }}`,
      );
  };
  m.customProgramCacheKey = () => (D ? 'schA' : 'schT') + (nurLinien ? 'L' : '');
  return m;
}
/** Kennung der Schraffuren (für den Neuaufbau, wenn sich Muster ändern). */
const schSig = () => JSON.stringify(S.sch.map((p) => [p.k, p.ein || p.L.length]));

// ---- Bibliothek: eigene und importierte Muster für neue Projekte merken
const SCH_BIB = 'maad.sch.v1';
function schBibMerken() {
  try {
    localStorage.setItem(SCH_BIB, JSON.stringify(S.sch));
  } catch (e) {
    logErr(e, 'schBibMerken');
  }
}
/** Muster prüfen (Laden). */
function schPruefen(L) {
  return (Array.isArray(L) ? L : [])
    .filter((p) => p && p.k && (p.ein || Array.isArray(p.L)))
    .map((p) => ({
      k: String(p.k),
      n: String(p.n || 'Muster').slice(0, 60),
      b: String(p.b || '').slice(0, 120),
      q: p.q === 'eigen' ? 'eigen' : 'pat',
      ...(p.ein
        ? {
            ein: {
              art: SCH_EINFACH[p.ein.art] ? p.ein.art : 'h',
              ah: +p.ein.ah || 0.1,
              av: +p.ein.av || 0.1,
            },
            L: [],
          }
        : {
            L: p.L.filter((f) => f && [f.a, f.x, f.y, f.dx, f.dy].every((v) => isFinite(+v))).map((f) => ({
              a: +f.a,
              x: +f.x,
              y: +f.y,
              dx: +f.dx,
              dy: +f.dy,
              d: (Array.isArray(f.d) ? f.d : []).map(Number).filter((v) => isFinite(v)),
            })),
          }),
    }));
}
/** Bibliothek ins Projekt holen (fehlende Schlüssel ergänzen). */
function schBibErgaenzen() {
  try {
    const B = schPruefen(JSON.parse(localStorage.getItem(SCH_BIB) || '[]'));
    B.forEach((p) => {
      if (!S.sch.some((q) => q.k === p.k)) S.sch.push(p);
    });
  } catch (e) {
    logErr(e, 'schBibErgaenzen');
  }
}

// ---- Bedienung im Fassadendesigner (Typen bearbeiten)
const SCHE = { typ: null, neu: null };
/** Kleine Vorschau eines Musters (Canvas als Bild). */
function schVorschau(t, w = 40, h = 28) {
  const H = schVonTyp(t);
  if (!H) return `<span class="schv schv0" style="width:${w}px;height:${h}px" aria-hidden="true"></span>`;
  try {
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = h * 2;
    const g = cv.getContext('2d');
    g.fillStyle = t.c || '#ddd';
    g.fillRect(0, 0, cv.width, cv.height);
    g.beginPath();
    g.rect(0, 0, cv.width, cv.height);
    // Vorschau im Maßstab: 1 Meter = 160 Bildpunkte
    schFuellen2D(g, t, 160, 0, cv.height);
    return `<img class="schv" src="${cv.toDataURL()}" width="${w}" height="${h}" alt="">`;
  } catch (e) {
    logErr(e, 'schVorschau');
    return '';
  }
}
/** Zeile unter einem Fassadentyp: Schraffur wählen und einstellen. */
function schTypHtml(i) {
  const t = S.ft[i];
  if (!t || t.df) return '';
  const auf = SCHE.typ === i,
    P = t.sch && schG(t.sch.k),
    alle = schAlle(),
    opt = (q, n) =>
      alle
        .filter((p) => p.q === q)
        .map((p) => `<option value="${esc(p.k)}" ${P && P.k === p.k ? 'selected' : ''}>${esc(p.n)}</option>`)
        .join(''),
    H = schVonTyp(t);
  let h = `<button class="schz${auf ? ' on' : ''}" onclick="SCHE.typ=${auf ? 'null' : i};FDS.ps='';fdTick(true)" aria-expanded="${auf}" title="Schraffur für „${esc(t.n)}“">${schVorschau(t)}<span>${P ? esc(P.n) : 'ohne Schraffur'}</span></button>`;
  if (!auf) return h;
  h += `<div class="sche"><label>Muster<select onchange="schTypSet(${i},'k',this.value)"><option value="">ohne</option>${
    S.sch.some((p) => p.q === 'eigen') ? `<optgroup label="Eigene">${opt('eigen')}</optgroup>` : ''
  }<optgroup label="Mitgeliefert">${opt('de')}</optgroup>${
    S.sch.some((p) => p.q === 'pat') ? `<optgroup label="Importiert">${opt('pat')}</optgroup>` : ''
  }</select></label>`;
  if (H)
    h += `<label>Linienfarbe<input type="color" value="${H.c}" onchange="schTypSet(${i},'c',this.value)"></label><label title="Größe einer Mustereinheit in der Wirklichkeit">Maßstab (cm je Einheit)<input type="number" step="any" min="0.01" value="${+(H.e * 100).toPrecision(4)}" onchange="schTypSet(${i},'e',this.value)"></label><label>Winkel (°)<input type="number" step="5" value="${H.w}" onchange="schTypSet(${i},'w',this.value)"></label>`;
  return h + '</div>';
}
/** Schraffur eines Fassadentyps ändern (k Muster, c Linienfarbe, e Maßstab in cm, w Winkel). */
function schTypSet(i, f, v) {
  const t = S.ft[i];
  if (!t) return;
  if (f === 'k') {
    if (!v || !schG(v)) delete t.sch;
    else t.sch = { k: v, c: (t.sch && t.sch.c) || '#2f3337', w: (t.sch && t.sch.w) || 0 };
  } else if (t.sch) {
    if (f === 'c' && /^#[0-9a-f]{6}$/i.test(v)) t.sch.c = v;
    if (f === 'e' && +v > 0) t.sch.e = +v / 100;
    if (f === 'w' && isFinite(+v)) t.sch.w = +v;
  }
  fdTypeSet(i, 'c', t.c); // Neuzeichnen wie bei einer Farbänderung
}
/** Abschnitt „Muster“ unter der Typliste: importieren, einfaches Muster anlegen, eigene löschen. */
function schMusterHtml() {
  const N = SCHE.neu;
  let h = `<h4>Muster</h4><div class="row"><button class="bt" onclick="schImportWahl()" title="Schraffurmuster aus .pat-Dateien (AutoCAD, Revit) übernehmen – mehrere auf einmal möglich">.pat importieren …</button><button class="bt" onclick="SCHE.neu={art:'h',ah:10,av:10,n:'Eigenes Muster'};FDS.ps='';fdTick(true)">Einfaches Muster …</button></div>`;
  if (N) {
    const t = { c: '#e8e4dc', sch: { k: '_vorschau', e: 1, c: '#2f3337' } };
    SCH.vorschau = {
      k: '_vorschau',
      n: N.n,
      q: 'eigen',
      ein: { art: N.art, ah: N.ah / 100, av: N.av / 100 },
      L: [],
    };
    h += `<div class="sche"><div class="schneu">${schVorschauVon(t, SCH.vorschau)}</div><label>Name<input type="text" value="${esc(N.n)}" onchange="SCHE.neu.n=this.value"></label><label>Art<select onchange="SCHE.neu.art=this.value;FDS.ps='';fdTick(true)">${Object.entries(
      SCH_EINFACH,
    )
      .map(([k, n]) => `<option value="${k}" ${N.art === k ? 'selected' : ''}>${n}</option>`)
      .join('')}</select></label>${
      N.art !== 'v'
        ? `<label>${N.art === 'h' || N.art === 'x' ? 'Abstand waagerechte Linien' : 'Abstand'} (cm)<input type="number" min="0.5" step="0.5" value="${N.ah}" onchange="SCHE.neu.ah=Math.max(0.5,+this.value||10);FDS.ps='';fdTick(true)"></label>`
        : ''
    }${
      N.art === 'v' || N.art === 'x' || N.art === 'dx'
        ? `<label>${N.art === 'dx' ? 'Abstand zweite Richtung' : 'Abstand senkrechte Linien'} (cm)<input type="number" min="0.5" step="0.5" value="${N.av}" onchange="SCHE.neu.av=Math.max(0.5,+this.value||10);FDS.ps='';fdTick(true)"></label>`
        : ''
    }<div class="row"><button class="bt pri" onclick="schNeuSpeichern()">Muster anlegen</button><button class="bt" onclick="SCHE.neu=null;FDS.ps='';fdTick(true)">Abbrechen</button></div></div>`;
  }
  const eig = S.sch;
  if (eig.length)
    h += eig
      .map(
        (p) =>
          `<div class="fe"><span style="flex:1">${esc(p.n)}<small class="mu"> ${p.q === 'eigen' ? 'eigen' : 'importiert'}</small></span><button class="ib" onclick="schLoeschen('${esc(p.k)}')" title="Muster löschen (Typen damit werden ohne Schraffur)">${fdIcon('x')}</button></div>`,
      )
      .join('');
  return h;
}
/** Vorschau für ein Muster, das noch nicht in der Liste ist (Editor). */
function schVorschauVon(t, P) {
  const alt = SCH.de;
  try {
    SCH.de = (alt || []).concat([P]);
    return schVorschau(t, 120, 60);
  } finally {
    SCH.de = alt;
  }
}
function schNeuSpeichern() {
  const N = SCHE.neu;
  if (!N) return;
  S.sch.push({
    k: 'ei' + Date.now().toString(36),
    n: String(N.n || 'Eigenes Muster').slice(0, 60),
    b: '',
    q: 'eigen',
    ein: { art: N.art, ah: N.ah / 100, av: N.av / 100 },
    L: [],
  });
  SCHE.neu = null;
  schBibMerken();
  FDS.ps = '';
  fdTick(true);
}
function schLoeschen(k) {
  S.sch = S.sch.filter((p) => p.k !== k);
  S.ft.forEach((t) => {
    if (t.sch && t.sch.k === k) delete t.sch;
  });
  schBibMerken();
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
}
/** Dateiauswahl für den Import (.pat, mehrere). */
function schImportWahl() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.pat';
  inp.multiple = true;
  inp.onchange = async () => {
    let n = 0;
    for (const f of inp.files || []) {
      try {
        schParse(schDekodieren(await f.arrayBuffer())).forEach((p) => {
          const k = 'pat:' + p.n;
          S.sch = S.sch.filter((q) => q.k !== k);
          S.sch.push({ k, n: p.n, b: p.b, q: 'pat', L: p.L });
          n++;
        });
      } catch (e) {
        logErr(e, 'schImportWahl');
      }
    }
    schBibMerken();
    fdNote(n ? `${n} Muster übernommen.` : 'In den Dateien wurde kein Muster gefunden.');
    FDS.ps = '';
    fdTick(true);
  };
  inp.click();
}
