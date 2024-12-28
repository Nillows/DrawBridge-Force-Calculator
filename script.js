function calculateValues() {
  // =============================
  // 1) Grab form inputs
  // =============================
  const lengthUnit = document.getElementById('length-unit').value; 
  const massUnit   = document.getElementById('mass-unit').value;
  const ropeCount  = parseInt(document.getElementById('rope-count').value);

  // Bed geometry
  const L_raw  = parseFloat(document.getElementById('bed-length').value); // pivot -> top
  const X_raw  = parseFloat(document.getElementById('bed-weight').value); // bed mass or weight
  const Y_raw  = parseFloat(document.getElementById('anchor-y').value);   // anchor along bed length
  const theta  = parseFloat(document.getElementById('theta').value);      // bed angle (deg)

  // Pulley geometry
  const D_raw  = parseFloat(document.getElementById('pulley-d').value);   // horizontal offset from center
  const H_raw  = parseFloat(document.getElementById('pulley-h').value);   // vertical offset above pivot
  const Z_raw  = parseFloat(document.getElementById('pulley-circ').value);// pulley circumference

  // Gravity
  const g = parseFloat(document.getElementById('gravity').value);

  // Convert deg->rad
  const thetaRad = (Math.PI / 180) * theta;

  // =============================
  // 2) LENGTH UNIT CONVERSION -> m
  // =============================
  let lengthConvText = "No length conversion (already in meters).";
  let L_m = L_raw;
  let Y_m = Y_raw;
  let D_m = D_raw;
  let H_m = H_raw;
  let Z_m = Z_raw;

  if (lengthUnit === "feet") {
    const ft2m = 0.3048;
    L_m = L_raw * ft2m;
    Y_m = Y_raw * ft2m;
    D_m = D_raw * ft2m;
    H_m = H_raw * ft2m;
    Z_m = Z_raw * ft2m;

    lengthConvText =
      `Converting from feet to meters:\n` +
      ` L(m) = ${L_raw.toFixed(3)} * 0.3048 = ${L_m.toFixed(3)}\n` +
      ` Y(m) = ${Y_raw.toFixed(3)} * 0.3048 = ${Y_m.toFixed(3)}\n` +
      ` D(m) = ${D_raw.toFixed(3)} * 0.3048 = ${D_m.toFixed(3)}\n` +
      ` H(m) = ${H_raw.toFixed(3)} * 0.3048 = ${H_m.toFixed(3)}\n` +
      ` Z(m) = ${Z_raw.toFixed(3)} * 0.3048 = ${Z_m.toFixed(3)}\n`;
  }

  // =============================
  // 3) MASS/WEIGHT -> Force in N
  // =============================
  // If "kg", interpret X_raw as mass => bedForce_N = X_raw * g
  // If "lb", interpret X_raw as weight => bedForce_N = X_raw * 4.448221615
  let bedForce_N = 0;
  let massConvText = "";

  if (massUnit === "kg") {
    bedForce_N = X_raw * g;
    massConvText =
      `Interpreting X as mass (kg):\n` +
      ` bedForce_N = ${X_raw.toFixed(3)} * ${g} = ${bedForce_N.toFixed(3)} N\n`;
  } else {
    const LB2N = 4.448221615;
    bedForce_N = X_raw * LB2N;
    massConvText =
      `Interpreting X as weight (lb_f):\n` +
      ` 1 lb_f = 4.448221615 N\n` +
      ` bedForce_N = ${X_raw.toFixed(3)} * 4.448221615 = ${bedForce_N.toFixed(3)} N\n`;
  }

  // =============================
  // 4) ROPE ANGLE φ from geometry
  // =============================
  // bed anchor vector b = (b_x, b_y) = ( Y_m*cosθ, Y_m*sinθ )
  // rope vector r = (r_x, r_y) = ( D_m - b_x, H_m - b_y )
  // φ = arccos( (b·r) / (|b|*|r|) )
  const b_x = Y_m * Math.cos(thetaRad);
  const b_y = Y_m * Math.sin(thetaRad);

  const r_x = D_m - b_x;
  const r_y = H_m - b_y;

  const dot_br = b_x*r_x + b_y*r_y;
  const mag_b  = Math.sqrt(b_x*b_x + b_y*b_y);
  const mag_r  = Math.sqrt(r_x*r_x + r_y*r_y);

  let phiDeg = 0;
  let ropeAngleText = "";
  if (mag_b > 0 && mag_r > 0) {
    const phiRad = Math.acos(dot_br / (mag_b * mag_r));
    phiDeg = (phiRad * 180) / Math.PI;

    ropeAngleText =
      `bed vector b = (${b_x.toFixed(3)}, ${b_y.toFixed(3)})\n` +
      `rope vector r = (${r_x.toFixed(3)}, ${r_y.toFixed(3)})\n` +
      `b·r = ${dot_br.toFixed(3)},  |b|=${mag_b.toFixed(3)},  |r|=${mag_r.toFixed(3)}\n\n` +
      `φ = arccos( (b·r)/(|b|·|r|) )\n` +
      `  = arccos( ${dot_br.toFixed(3)} / ${(mag_b*mag_r).toFixed(3)} )\n` +
      `  = ${phiDeg.toFixed(2)}°`;
  } else {
    ropeAngleText = "Invalid geometry (check inputs).";
  }

  // =============================
  // 5) Torque & Counterweight
  // =============================
  // torqueBed = bedForce_N * (L_m/2) * cos(θ)
  // T * (Y_m*sinφ) = torqueBed => T = torqueBed / [Y_m*sinφ]
  let torqueCounterText = "";
  let finalResults = "";

  if (phiDeg > 0 && phiDeg < 180) {
    const torqueBed = bedForce_N * (L_m / 2) * Math.cos(thetaRad);

    // sinφ in radians
    const phiRad   = (Math.PI/180)*phiDeg;
    const tensionN = torqueBed / (Y_m * Math.sin(phiRad));

    // Pulley torque => τ_pulley = T * r, r = Z_m/(2π)
    const r_pulley = Z_m / (2 * Math.PI);
    const tauPulley = tensionN * r_pulley;

    // 1-rope vs 2-rope scenario
    let tensionPerRope = tensionN;
    if (ropeCount === 2) {
      tensionPerRope = tensionN / 2;
    }

    // Convert tension for "counterweight" concept
    // If 'kg': T(N)= M(kg)*g => M= T/g
    // If 'lb': T(N)=> T(lb_f)=T(N)/4.448221615 => M= T(lb_f)
    const LB2N = 4.448221615;
    let finalCounterVal = 0;
    let counterText = "";

    if (massUnit === "kg") {
      finalCounterVal = tensionN / g;
      counterText =
        `Counterweight (kg) = T(N) / g\n` +
        `                   = ${tensionN.toFixed(3)} / ${g}\n` +
        `                   = ${finalCounterVal.toFixed(3)} kg`;
    } else {
      finalCounterVal = tensionN / LB2N;
      counterText =
        `Counterweight (lb_f) = T(N) / 4.448221615\n` +
        `                     = ${tensionN.toFixed(3)} / 4.448221615\n` +
        `                     = ${finalCounterVal.toFixed(3)} lb_f`;
    }

    torqueCounterText =
      `Torque from bed = bedForce_N * (L_m/2) * cos(θ)\n` +
      `                = ${bedForce_N.toFixed(3)} * (${L_m.toFixed(3)}/2) * cos(${theta.toFixed(1)}°)\n` +
      `                = ${torqueBed.toFixed(3)} N·m\n\n` +
      `Tension T (total) = torqueBed / [Y_m * sin(φ)]\n` +
      `                  = ${torqueBed.toFixed(3)} / [${Y_m.toFixed(3)} * sin(${phiDeg.toFixed(1)}°)]\n` +
      `                  = ${tensionN.toFixed(3)} N\n\n` +
      `Pulley radius = Z_m/(2π) = ${Z_m.toFixed(3)}/(2π) = ${r_pulley.toFixed(3)} m\n` +
      `Pulley torque = T * r_pulley = ${tensionN.toFixed(3)} * ${r_pulley.toFixed(3)} = ${tauPulley.toFixed(3)} N·m\n\n` +
      (ropeCount === 2 
        ? `With 2 ropes, each rope carries T/2 = ${(tensionN/2).toFixed(3)} N\n\n`
        : ""
       ) +
      `${counterText}`;

    finalResults =
      `Rope Angle φ:           ${phiDeg.toFixed(2)}°\n` +
      `Total Rope Tension (N): ${tensionN.toFixed(3)}\n` +
      (ropeCount === 2
        ? `Tension per Rope (N):   ${(tensionN / 2).toFixed(3)}\n`
        : ""
      ) +
      `Pulley Torque (N·m):    ${tauPulley.toFixed(3)}\n` +
      (massUnit === "kg"
        ? `Counterweight (kg):      ${finalCounterVal.toFixed(3)}`
        : `Counterweight (lb_f):    ${finalCounterVal.toFixed(3)}`
      ) +
      (ropeCount === 2
        ? `\n(Each rope is half the tension.)`
        : ""
      );
  } else {
    torqueCounterText = "Cannot compute torque/tension due to invalid rope angle.";
    finalResults = "Error in geometry. Check the inputs.";
  }

  // =============================
  // 6) Populate the output
  // =============================
  document.getElementById('eq-length-conversion').textContent       = lengthConvText;
  document.getElementById('eq-mass-conversion').textContent         = massConvText;
  document.getElementById('eq-rope-angle').textContent              = ropeAngleText;
  document.getElementById('eq-torque-counterweight').textContent    = torqueCounterText;
  document.getElementById('results-output').textContent             = finalResults;
}
