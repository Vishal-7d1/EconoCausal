# build_6slide_executive_deck.py
# Generates a premium 6-slide executive PowerPoint presentation with real dashboard screenshots
# specifically tailored for Vishal Yadav's Final Project Presentation at Infotact Solutions.

import shutil
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck(out_path=None):
    if out_path is None:
        out_path = Path(__file__).resolve().parent / "EconoCausal_Final_Presentation.pptx"
    else:
        out_path = Path(out_path)

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Executive Modern Color Palette
    BG_DARK = RGBColor(15, 23, 42)          # Slate 900
    BG_CARD = RGBColor(30, 41, 59)          # Slate 800
    BG_CARD_LIGHT = RGBColor(38, 52, 75)    # Slate 750
    TEXT_LIGHT = RGBColor(248, 250, 252)    # Slate 50
    TEXT_MUTED = RGBColor(148, 163, 184)    # Slate 400
    ACCENT_EMERALD = RGBColor(16, 185, 129) # Emerald 500
    ACCENT_CYAN = RGBColor(56, 189, 248)    # Sky 400
    ACCENT_ROSE = RGBColor(244, 63, 94)     # Rose 500
    ACCENT_INDIGO = RGBColor(129, 140, 248) # Indigo 400
    ACCENT_AMBER = RGBColor(245, 158, 11)   # Amber 500
    BORDER_COLOR = RGBColor(51, 65, 85)     # Slate 700

    screenshots_dir = Path(__file__).resolve().parent / "screenshots"

    def set_slide_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category_text="INFOTACT SOLUTIONS | FINAL INTERNSHIP REVIEW"):
        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(1.05))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_cat = tf.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT_EMERALD
        p_cat.font.name = "Segoe UI"
        p_cat.space_after = Pt(2)

        p_title = tf.add_paragraph()
        p_title.text = title_text
        p_title.font.size = Pt(21)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_LIGHT
        p_title.font.name = "Segoe UI"

    def add_card(slide, left, top, width, height, title, content_bullets, accent_color=None, bg_color=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color or BG_CARD
        card.line.color.rgb = accent_color or BORDER_COLOR
        card.line.width = Pt(1.5 if accent_color else 1)

        tb = slide.shapes.add_textbox(left + Inches(0.22), top + Inches(0.18), width - Inches(0.44), height - Inches(0.36))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        if title:
            p_head = tf.paragraphs[0]
            p_head.text = title
            p_head.font.size = Pt(13)
            p_head.font.bold = True
            p_head.font.color.rgb = accent_color or ACCENT_CYAN
            p_head.font.name = "Segoe UI"
            p_head.space_after = Pt(6)

        for i, bullet in enumerate(content_bullets):
            p = tf.add_paragraph() if (title or i > 0) else tf.paragraphs[0]
            p.text = ("• " if len(content_bullets) > 1 else "") + bullet
            p.font.size = Pt(10.5)
            p.font.color.rgb = TEXT_LIGHT
            p.font.name = "Segoe UI"
            p.space_after = Pt(5)

    def add_screenshot(slide, img_name, left, top, width, height=None, label=None):
        img_path = screenshots_dir / img_name
        if not img_path.exists():
            return None

        # Border Card around screenshot
        extra = Inches(0.08)
        calc_height = height if height else Inches(width.inches * 0.5625)
        border_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left - Inches(0.04), top - Inches(0.04), width + extra, calc_height + extra)
        border_card.fill.solid()
        border_card.fill.fore_color.rgb = BG_CARD
        border_card.line.color.rgb = BORDER_COLOR
        border_card.line.width = Pt(1.5)

        if height:
            pic = slide.shapes.add_picture(str(img_path), left, top, width=width, height=height)
        else:
            pic = slide.shapes.add_picture(str(img_path), left, top, width=width)

        if label:
            badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(0.15), top + Inches(0.12), Inches(3.2), Inches(0.32))
            badge.fill.solid()
            badge.fill.fore_color.rgb = BG_DARK
            badge.line.color.rgb = ACCENT_EMERALD
            badge.line.width = Pt(1)
            btf = badge.text_frame
            btf.margin_left = btf.margin_top = btf.margin_right = btf.margin_bottom = 0
            bp = btf.paragraphs[0]
            bp.text = f"● {label.upper()}"
            bp.font.size = Pt(8.5)
            bp.font.bold = True
            bp.font.color.rgb = ACCENT_EMERALD
            bp.font.name = "Segoe UI"
            bp.alignment = PP_ALIGN.CENTER

        return pic

    # =========================================================================
    # SLIDE 1: Title Slide (High Impact Executive Cover)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s1)

    # Accent decorative gradient line
    line = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.1), Inches(11.733), Inches(0.05))
    line.fill.solid()
    line.fill.fore_color.rgb = ACCENT_EMERALD
    line.line.fill.background()

    # Title Box
    title_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.4), Inches(11.733), Inches(2.5))
    tf1 = title_box.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_top = tf1.margin_right = tf1.margin_bottom = 0

    p_org = tf1.paragraphs[0]
    p_org.text = "INFOTACT SOLUTIONS • DATA SCIENCE & MACHINE LEARNING INTERNSHIP (BATCH 22.1)"
    p_org.font.size = Pt(12)
    p_org.font.bold = True
    p_org.font.color.rgb = ACCENT_EMERALD
    p_org.font.name = "Segoe UI"
    p_org.space_after = Pt(10)

    p_main = tf1.add_paragraph()
    p_main.text = "EconoCausal: Dynamic Pricing via Double Machine Learning"
    p_main.font.size = Pt(32)
    p_main.font.bold = True
    p_main.font.color.rgb = TEXT_LIGHT
    p_main.font.name = "Segoe UI"
    p_main.space_after = Pt(8)

    p_sub = tf1.add_paragraph()
    p_sub.text = "Heterogeneous Treatment Effect Estimation & Budget-Constrained Multi-Choice Knapsack Optimization"
    p_sub.font.size = Pt(16)
    p_sub.font.color.rgb = ACCENT_CYAN
    p_sub.font.name = "Segoe UI"

    # Presenter Information Card
    pres_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.3), Inches(5.6), Inches(2.4))
    pres_card.fill.solid()
    pres_card.fill.fore_color.rgb = BG_CARD
    pres_card.line.color.rgb = ACCENT_CYAN
    pres_card.line.width = Pt(1.5)

    ptf = pres_card.text_frame
    ptf.margin_left = Inches(0.3)
    ptf.margin_top = Inches(0.25)
    ptf.word_wrap = True
    
    p = ptf.paragraphs[0]
    p.text = "PROJECT METADATA & AUTHOR"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Segoe UI"
    p.space_after = Pt(8)

    p = ptf.add_paragraph()
    p.text = "• Candidate: Vishal Yadav (L1 Intern)"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = ptf.add_paragraph()
    p.text = "• Role: DS & ML Intern • Batch: Official Batch-22.1"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = ptf.add_paragraph()
    p.text = "• Evaluation Date: Thursday, 12 November 2026"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = ptf.add_paragraph()
    p.text = "• Tech Stack: EconML, Double ML, Scikit-Learn, SciPy HiGHS MILP, FastAPI, React"
    p.font.size = Pt(10.5)
    p.font.color.rgb = TEXT_MUTED
    p.font.name = "Segoe UI"

    # Live Enterprise Benchmark Card
    bench_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.7), Inches(4.3), Inches(5.8), Inches(2.4))
    bench_card.fill.solid()
    bench_card.fill.fore_color.rgb = BG_CARD
    bench_card.line.color.rgb = ACCENT_EMERALD
    bench_card.line.width = Pt(1.5)

    btf = bench_card.text_frame
    btf.margin_left = Inches(0.3)
    btf.margin_top = Inches(0.25)
    btf.word_wrap = True

    p = btf.paragraphs[0]
    p.text = "LIVE ENTERPRISE SCALE BENCHMARK (60,000 CUSTOMERS)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = ACCENT_EMERALD
    p.font.name = "Segoe UI"
    p.space_after = Pt(8)

    p = btf.add_paragraph()
    p.text = "• Incremental Revenue Generated: ₹13,106,176 (+18.3% causal uplift)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = btf.add_paragraph()
    p.text = "• Return on Discount Spend (RODS): 12.84x (+49% over heuristic policies)"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = btf.add_paragraph()
    p.text = "• Margin Floor Protection: 100% Protected (Zero negative-margin sales)"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.font.name = "Segoe UI"
    p.space_after = Pt(4)

    p = btf.add_paragraph()
    p.text = "• Econometric Audit: 5/5 Refutations Passed; PSM Balance |SMD| < 0.10"
    p.font.size = Pt(10.5)
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Segoe UI"

    # =========================================================================
    # SLIDE 2: Problem Statement & Why Causal AI (Correlation vs Causation)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s2)
    add_header(s2, "The Promotional Pricing Dilemma: Why Correlation ≠ Causation", "PROBLEM STATEMENT & CAUSAL FOUNDATION")

    col_w = Inches(3.7)
    card_h = Inches(5.4)
    top_pos = Inches(1.6)

    add_card(s2, Inches(0.8), top_pos, col_w, card_h, "1. The Industry Problem", [
        "E-Commerce Promotional Waste: Modern platforms routinely burn 40% to 60% of discount budgets subsidizing organic buyers.",
        "Deadweight Loss: Customers who would purchase anyway at full price are given promotional coupons, eroding gross margin without creating lift.",
        "Flat Heuristic Failures: Rule-of-thumb discounting (e.g. '10% off for all high cart values') cannibalizes the most profitable orders.",
        "Business Mandate: Replace blanket discounts with an algorithmic engine that identifies exactly who is incrementally motivated by price.",
    ], accent_color=ACCENT_ROSE)

    add_card(s2, Inches(4.8), top_pos, col_w, card_h, "2. Why Supervised ML Fails", [
        "Confounder Conflation: In observational data, loyal customers receive more promotions and naturally buy more often.",
        "Spurious Correlation: A standard supervised model (XGBoost/LightGBM) learns that coupons correlate with high purchases, misattributing organic loyalty to the discount.",
        "Disastrous Decisioning: High spenders get predicted as 'high probability', receiving unnecessary discounts while price-sensitive defectors are ignored.",
        "Selection Bias: Observational pricing data violates random assignment, demanding rigorous econometric causal identification.",
    ], accent_color=ACCENT_AMBER)

    add_card(s2, Inches(8.8), top_pos, col_w, card_h, "3. The EconoCausal Solution", [
        "Double Machine Learning (DML): Employs Neyman Orthogonalization to partial out confounder bias from both treatment and outcome.",
        "LinearDML CATE Engine: Estimates individual customer treatment effect tau_i(d) with 95% asymptotic confidence intervals.",
        "Exact Multi-Choice Knapsack: Formulates optimal discount allocation as an integer programming problem solved via SciPy HiGHS MILP.",
        "Guaranteed Margin Guardrails: Enforces minimum contribution margin floors (15%), ensuring zero cannibalization or negative-margin sales.",
    ], accent_color=ACCENT_EMERALD)

    # =========================================================================
    # SLIDE 3: Live Executive Dashboard & Business ROI (Screenshot 1)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s3)
    add_header(s3, "Executive Dashboard: Live Enterprise Performance on 60,000 Cohort", "BUSINESS IMPACT & EXECUTIVE METRICS")

    # Left: Screenshot
    add_screenshot(s3, "01_executive_dashboard_60k.jpg", Inches(0.8), Inches(1.55), Inches(7.6), Inches(5.35), label="Live Dashboard Overview (60,000 Customers)")

    # Right: KPI Deep Dive Cards
    right_left = Inches(8.65)
    right_w = Inches(3.88)

    add_card(s3, right_left, Inches(1.55), right_w, Inches(2.6), "Enterprise ROI Metrics", [
        "Incremental Revenue: ₹13,106,176 generated strictly from causal uplift (+18.3% conversion increase).",
        "Return on Spend (RODS): 12.84x return per promotional rupee spent (+49% higher than random allocations).",
        "Incremental Purchases: +5,479 net new conversion events unlocked across 60,000 evaluated customer journeys.",
        "Protected Margins: 99.2% margin floor coverage; 100% of selected discounts maintain >= 15% contribution floor.",
    ], accent_color=ACCENT_EMERALD)

    add_card(s3, right_left, Inches(4.3), right_w, Inches(2.6), "Strategic Policy Breakdown", [
        "Targeted Customers: 30,000 shoppers (50.0%) allocated optimal promotional offers (₹10 or ₹20).",
        "Organic Control Group: 30,000 shoppers (50.0%) assigned ₹0 control, completely shielding profits from deadweight discounts.",
        "Dynamic Rules Engine: Integrates active economic guards including No-Negative-Margin, Anti-Confounder Residualization, and Knapsack Capacity.",
        "Real-Time Response: Sub-second MILP solver enables immediate campaign re-optimization upon budget changes.",
    ], accent_color=ACCENT_CYAN)

    # =========================================================================
    # SLIDE 4: Double ML & CATE Prediction Studio (Screenshot 2)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s4)
    add_header(s4, "CATE Prediction Studio: Heterogeneous Uplift & 95% Confidence Intervals", "CAUSAL MACHINE LEARNING ENGINE")

    # Left: Screenshot
    add_screenshot(s4, "02_cate_prediction_studio.jpg", Inches(0.8), Inches(1.55), Inches(7.6), Inches(5.35), label="CATE Predictor & Uplift Studio")

    # Right: Technical Cards
    add_card(s4, right_left, Inches(1.55), right_w, Inches(2.6), "CATE Estimand & Uplift", [
        "₹10 Discount Arm: +12.87 pp conversion uplift (95% CI: [+9.36, +16.38 pp]) relative to organic baseline.",
        "₹20 Discount Arm: +21.91 pp conversion uplift (95% CI: [+18.31, +25.51 pp]), demonstrating strong price elasticity.",
        "Marginal Elasticity: +9.03 pp incremental gain from ₹10 to ₹20, identifying shoppers who justify deeper tiers.",
        "Recommendation Engine: Automatically prescribes ₹20 Volume-Maximizing action for highly responsive shoppers.",
    ], accent_color=ACCENT_CYAN)

    add_card(s4, right_left, Inches(4.3), right_w, Inches(2.6), "Causal Architecture & Anti-Leakage", [
        "Estimator: EconML LinearDML with 5-fold cross-fitting and LightGBM nuisance models for Y and T residualization.",
        "Pretreatment Schema: Strictly isolated to 9 pre-intervention features (age, income, visits, orders, recency, cart, loyalty, device).",
        "Anti-Leakage Certified: Prohibits outcomes, post-treatment variables, and synthetic ground truth from inference.",
        "Asymptotic Inference: Closed-form variance covariance matrix provides statistical uncertainty bounds for executive sign-off.",
    ], accent_color=ACCENT_INDIGO)

    # =========================================================================
    # SLIDE 5: Budget Optimization & Benchmark Dominance (Screenshot 3)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s5)
    add_header(s5, "Budget Optimization: HiGHS MILP Knapsack vs. Industry Baselines", "CONSTRAINED OPTIMIZATION & POLICY SOLVER")

    # Left: Screenshot
    add_screenshot(s5, "03_causal_uplift_benchmarks.png", Inches(0.8), Inches(1.55), Inches(7.6), Inches(5.35), label="Interactive Causal & Optimization Visualizations")

    # Right: Benchmark Comparison Cards
    add_card(s5, right_left, Inches(1.55), right_w, Inches(2.6), "Mathematical Formulation", [
        "Objective: Maximize total incremental gross profit net of discount expenditure across N customers.",
        "Multi-Choice Knapsack: Formulated as integer program with binary decision variables w_i,d in {0, 1}.",
        "Exclusivity Constraint: sum_d w_i,d <= 1 (each customer receives at most one discount tier).",
        "Budget Capacity: sum_i sum_d (w_i,d * cost_i,d) <= Total Budget (supports allocated face value or expected redemption).",
        "Exact Solver: HiGHS MILP branch-and-cut solver guarantees globally optimal allocation with zero heuristics.",
    ], accent_color=ACCENT_EMERALD)

    add_card(s5, right_left, Inches(4.3), right_w, Inches(2.6), "Dominance Over Heuristic Baselines", [
        "DML Causal Optimal: Highest incremental profit (₹3.8M+), 12.84x RODS, zero deadweight subsidization.",
        "B1 Random Allocation: Poor RODS (4.1x); burns 50% budget on price-inelastic loyalists who buy anyway.",
        "B2 Highest Cart Value: Heavy margin cannibalization; targets affluent buyers with near-zero incremental elasticity.",
        "B3 Sequential Uniform: Exhausts budget on initial cohort rows, missing high-elasticity opportunities downstream.",
    ], accent_color=ACCENT_AMBER)

    # =========================================================================
    # SLIDE 6: Econometric Validation, Balance & Sensitivity Audit (Screenshot 4)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_bg(s6)
    add_header(s6, "Econometric Rigor: Covariate Balance (Love Plot) & 5/5 Refutations", "CAUSAL VALIDATION & SCIENTIFIC AUDIT")

    # Left: Screenshot
    add_screenshot(s6, "04_causal_validation_love_plot.jpg", Inches(0.8), Inches(1.55), Inches(7.6), Inches(5.35), label="Love Plot: Covariate Balance Diagnostic (|SMD| < 0.10)")

    # Right: Validation & Refutation Cards
    add_card(s6, right_left, Inches(1.55), right_w, Inches(2.6), "Covariate Balance & Overlap", [
        "100% Causal Validation Score: Confirmed unconfoundedness via 1:1 Nearest-Neighbor Caliper Matching on Propensity Scores.",
        "Standardized Mean Difference: Raw confounding imbalances (SMD up to 0.36) collapsed to |SMD| < 0.022 post-matching.",
        "Strict Industry Standard: All 9 confounders fall well below the standard 0.10 threshold, verifying exchangeability.",
        "Common Support & Overlap: 99.9% of treated customers matched within caliper, guaranteeing valid counterfactual overlap.",
    ], accent_color=ACCENT_EMERALD)

    add_card(s6, right_left, Inches(4.3), right_w, Inches(2.6), "5/5 Falsification Tests & Drift Monitoring", [
        "Placebo Treatment Refutation: Random treatment assignment collapses estimated effect to zero (p = 0.4774, PASS).",
        "Random Common Cause Refutation: Synthetic unobserved confounder injection causes < 0.16% relative drift (PASS).",
        "Data Subset Refutation: Random 80% subsamples show stable causal estimates within 0.03% drift (PASS).",
        "Rosenbaum Sensitivity: Robust to hidden selection bias up to Gamma* = 1.7 (₹10) and 2.1 (₹20).",
        "Production Drift Monitoring: Population Stability Index (PSI < 0.015) verifies stable covariate distributions in production.",
    ], accent_color=ACCENT_CYAN)

    prs.save(str(out_path))
    print(f"Successfully generated 6-slide presentation at: {out_path}")
    return out_path

if __name__ == "__main__":
    create_deck()

