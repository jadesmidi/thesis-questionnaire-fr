import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from itertools import combinations
from collections import defaultdict, Counter
import json
from typing import Dict, List

PARTIES = ['Renaissance','Les Républicains','Les Écologistes','PS','PCF','Rassemblement National','Reconquête','LFI']

LAST_ELECTION_SEATS = {
    'Renaissance':           91,
    'Les Républicains':       48,
    'Les Écologistes':        38,
    'PS':                     68,
    'PCF':                    17,
    'Rassemblement National': 122,
    'Reconquête':             0,
    'LFI':                    71,
}
NAME_MAPPING = {
    'LR': 'Les Républicains',
    'Les Republicans': 'Les Républicains'
}
TOTAL_SEATS = 455
MAJORITY = TOTAL_SEATS // 2 + 1

df = pd.read_csv("survey_data_fr.csv")
df['ranking_list'] = df['Ranking'].apply(
    lambda x: [p.strip() for p in str(x).split('>')]
)
df = df.dropna(subset=['Ranking'])
df['passed_attention'] = df['V0'] == 'A'
df_clean = df[df['passed_attention']].copy()

df_clean['GestemdePartij'] = df_clean['GestemdePartij'].astype(str).str.strip()
df_clean['GestemdePartij'] = df_clean['GestemdePartij'].replace('LR', 'Les Républicains')


def compute_survey_weights(df, voted_col='GestemdePartij',
                           election_seats=LAST_ELECTION_SEATS):
    voted = df[voted_col].copy().astype(str).str.strip()
    counts = voted.value_counts()
    total = counts / counts.sum()
 
    new_seats = {p: election_seats.get(p, 0) for p in total.index}
    new = sum(new_seats.values())
    part = {p: s / new for p, s in new_seats.items()}
 
    raw_weight = {
        p: (part.get(p, 0) / total[p]
            if total[p] > 0 and part.get(p, 0) > 0
            else 0.1)
        for p in total.index
    }
 
    weights_raw = voted.map(raw_weight).fillna(1.0)
    weights = weights_raw / weights_raw.mean()
    return weights

def get_survey_derived_seats_weighted(df, parties, weights, total_seats=122, verbose=False):

    "based on the first ranked-parties get the seats from the survey"

    first_choices = df['ranking_list'].apply(lambda x: x[0] if x else None)
    
    weighted_votes = {}
    for party in parties:
        weighted_votes[party] = sum(weights[first_choices == party])
    
    total_weighted_votes = sum(weights)
    
    if verbose:
        sorted_parties = sorted(parties, key=lambda p: weighted_votes[p], reverse=True)
        
        for party in sorted_parties:
            wv = weighted_votes[party]
            pct = (wv / total_weighted_votes) * 100 if total_weighted_votes > 0 else 0
            raw_seats = (wv / total_weighted_votes) * total_seats if total_weighted_votes > 0 else 0
            rounded_seats = round(raw_seats)
            print(f"{party:<24} {wv:>15.2f} {pct:>7.1f}% {raw_seats:>12.2f} {rounded_seats:>10}")
    
    seats_dict = {}
    for party in parties:
        if total_weighted_votes > 0:
            raw_seats = (weighted_votes[party] / total_weighted_votes) * total_seats
        else:
            raw_seats = 0
        seats_dict[party] = round(raw_seats)
    
    for party in parties:
        if seats_dict.get(party, 0) <= 0:
            seats_dict[party] = 1
    
    current_total = sum(seats_dict.values())
    
    if current_total != total_seats:
        diff = total_seats - current_total
        
        sorted_parties = sorted(parties, key=lambda p: weighted_votes[p], reverse=True)
        
        for i in range(abs(diff)):
            party = sorted_parties[i % len(sorted_parties)]
            if diff > 0:
                seats_dict[party] += 1
                if verbose:
                    print(f"  +1 seat to {party}")
            else:
                if seats_dict[party] > 1:
                    seats_dict[party] -= 1
                    if verbose:
                        print(f"  -1 seat from {party}")
    
    if verbose:
        print(f"\nFinal weighted seat allocation: {sum(seats_dict.values())} total")
        print("-" * 50)
        sorted_parties = sorted(parties, key=lambda p: seats_dict[p], reverse=True)
        for party in sorted_parties:
            print(f"  {party:<24} {seats_dict[party]:>3} seats")
        print(f"  {'TOTAL':<24} {sum(seats_dict.values()):>3} seats")
    
    return seats_dict
weights_for_seats = compute_survey_weights(df_clean, voted_col='GestemdePartij',
                           election_seats=LAST_ELECTION_SEATS)
SURVEY_SEATS = get_survey_derived_seats_weighted(df_clean, PARTIES, weights_for_seats, total_seats=TOTAL_SEATS, verbose=True)

def get_borda_scores_weighted(df, parties, weights):
    n = len(parties)
    scores = {p: 0.0 for p in parties}
    for (_, row), w in zip(df.iterrows(), weights):
        for i, party in enumerate(row['ranking_list']):
            if party in scores:
                scores[party] += w * (n - 1 - i)
    return pd.Series(scores).sort_values(ascending=False)
 
 
def get_copeland_scores_weighted(df, parties, weights):
    wins = {p: 0.0 for p in parties}
    for i, party_1 in enumerate(parties):
        for party_2 in parties[i+1:]:
            p1_score = sum(
                w for (_, row), w in zip(df.iterrows(), weights)
                if party_1 in row['ranking_list'] and party_2 in row['ranking_list']
                and row['ranking_list'].index(party_1) < row['ranking_list'].index(party_2)
            )
            p2_score = sum(weights) - p1_score
            if p1_score > p2_score:   wins[party_1] += 1
            elif p2_score > p1_score: wins[party_2] += 1
    return pd.Series(wins).sort_values(ascending=False)
 
def get_PAV_winner_weighted(df, parties, weights, seats=3):
    best_score, best_coalition = -1, None
    for coalition in combinations(parties, seats):
        score = sum(
            w * sum(1/(j+1) for j in range(sum(1 for p in coalition if row[p] > 0)))
            for (_, row), w in zip(df.iterrows(), weights)
        )
        if score > best_score:
            best_score, best_coalition = score, coalition
    return list(best_coalition), best_score

def get_STV_ranking_weighted(df, parties, weights):
    remaining_parties = parties.copy()
    elimination_order = []
    ballots = [
        {'prefs': [p for p in row['ranking_list'] if p in parties], 'weight': float(w)}
        for (_, row), w in zip(df.iterrows(), weights)
    ]
    while remaining_parties:
        vote_counts = {p: 0.0 for p in remaining_parties}
        for ballot in ballots:
            for party in ballot['prefs']:
                if party in remaining_parties:
                    vote_counts[party] += ballot['weight']
                    break
        if len(remaining_parties) == 1:
            elimination_order.append(remaining_parties[0])
            break
        last_candidate = min(vote_counts, key=vote_counts.get)
        elimination_order.append(last_candidate)
        remaining_parties.remove(last_candidate)
        for ballot in ballots:
            ballot['prefs'] = [p for p in ballot['prefs'] if p != last_candidate]
    return list(reversed(elimination_order))
 
 
def get_collective_ranking_weighted(df, parties, weights, agg_rule):
    "form collective ranking using only the voting rules"
    if agg_rule == 'borda':
        return list(get_borda_scores_weighted(df, parties, weights).index)
    elif agg_rule == 'plurality':
        first_votes = defaultdict(float)
        for (_, row), w in zip(df.iterrows(), weights):
            if row['ranking_list']:
                first_votes[row['ranking_list'][0]] += w
        return sorted(first_votes, key=first_votes.get, reverse=True)
    elif agg_rule == 'approval':
        total_w = sum(weights)
        avg = {p: sum(row[p] * w for (_, row), w in zip(df.iterrows(), weights)) / total_w
               for p in parties if p in df.columns}
        return sorted(avg, key=avg.get, reverse=True)
    elif agg_rule == 'copeland':
        return list(get_copeland_scores_weighted(df, parties, weights).index)
    elif agg_rule == 'stv':
        return get_STV_ranking_weighted(df, parties, weights)
    else:
        raise ValueError(f"Unknown agg_rule: {agg_rule}")

def pick_winner(ranked, seats, majority, approval, tol=1e-9):
    "deals with ties, first length of coal, then seats, welfare scores else alpahbetical"
    feasible = [c for c in ranked.index
                if sum(seats.get(p, 0) for p in c) >= majority]
    if not feasible:
        raise ValueError("No feasible coalition found in ranking!")
    top = max(ranked[c] for c in feasible)
    tied = [c for c in feasible if abs(ranked[c] - top) < tol]
    def welfare(c):
        return sum(approval.get(p, 0) for p in c)
    winner = min(tied, key=lambda c: (len(c),
                                      sum(seats.get(p, 0) for p in c),
                                      -welfare(c),
                                      c))
    return winner

def feasible_coalitions(parties, seats, majority, min_size=2):
    result = []
    for size in range(min_size, len(parties) + 1):
        for coalition in combinations(parties, size):
            coalition_seats = sum(seats.get(p, 0) for p in coalition)
            if coalition_seats >= majority:
                result.append(coalition)
    return result

def lift_individual(row, coalition, parties, lift_rule):
    "only lifting"
    ranking = row['ranking_list']
    if lift_rule == 'borda':
        return sum((len(parties) - 1 - ranking.index(p))
                   for p in coalition if p in ranking)
    elif lift_rule == 'max':
        position = [ranking.index(p) for p in coalition if p in ranking]
        return -min(position) if position else -999
    elif lift_rule == 'min':
        position = [ranking.index(p) for p in coalition if p in ranking]
        return -max(position) if position else -999
    elif lift_rule == 'approval':
        return sum(row[p] for p in coalition if p in row.index)
    else:
        raise ValueError(f"Unknown lift_rule: {lift_rule}")
    
def lift_then_aggregate_weighted(df, parties, seats, majority,
                        lift_rule='borda', agg_rule='utilitarian'):
    "first lifting then aggregating"
    coalitions = list(feasible_coalitions(parties, seats, majority))
    coalitions = [tuple(sorted(c)) for c in coalitions]
    coalitions = list(dict.fromkeys(coalitions))
    row_scores = []
    for _, row in df.iterrows():
        if lift_rule in ('borda', 'approval'):
            scores = {c: lift_individual(row, c, parties, lift_rule) / len(c)
                  for c in coalitions}
        else:
            scores = {c:lift_individual(row, c, parties, lift_rule)
                  for c in coalitions}
        row_scores.append(scores)

    row_rankings = [
        sorted(scores, key=lambda c: (-scores[c], len(c), c))
        for scores in row_scores
    ]

    if agg_rule == 'borda':
        n_coalition = len(coalitions)
        totals = {c: 0.0 for c in coalitions}
        for ranking, weight in zip(row_rankings, weights):
            for rank_position, c in enumerate(ranking):
                totals[c] += weight * (n_coalition - 1 - rank_position)
        ranked = pd.Series(list(totals.values()), index=list(totals.keys())).sort_values(ascending=False) 
 
    elif agg_rule == 'copeland':
        wins = {c: 0.0 for c in coalitions}
        for i, coalition_1 in enumerate(coalitions):
            for coalition_2 in coalitions[i+1:]:
                c1_score = sum(
                    w for ranking, w in zip(row_rankings, weights)
                    if ranking.index(coalition_1) < ranking.index(coalition_2)
                )
                c2_score = sum(weights) - c1_score
                if c1_score > c2_score:
                    wins[coalition_1] += 1
                elif c2_score > c1_score:
                    wins[coalition_2] += 1
        ranked = pd.Series(list(wins.values()), index=list(wins.keys())).sort_values(ascending=False)
 
    elif agg_rule == 'stv':
        remaining_parties = coalitions.copy()
        elimination_order = []
        ballots = [
            {'prefs': list(ranking), 'weight': float(w)}
            for ranking, w in zip(row_rankings, weights)
        ]
        while remaining_parties:
            vote_counts = {c: 0.0 for c in remaining_parties}
            for ballot in ballots:
                for c in ballot['prefs']:
                    if c in remaining_parties:
                        vote_counts[c] += ballot['weight']
                        break
            if len(remaining_parties) == 1:
                elimination_order.append(remaining_parties[0])
                break
            last_candidate = min(vote_counts, key=vote_counts.get)
            elimination_order.append(last_candidate)
            remaining_parties.remove(last_candidate)
            for ballot in ballots:
                ballot['prefs'] = [c for c in ballot['prefs'] if c != last_candidate]
        ranked = list(reversed(elimination_order))
        stv_scores = {c: len(ranked) - 1 - i for i, c in enumerate(ranked)}
        ranked = pd.Series(list(stv_scores.values()), index=list(stv_scores.keys())).sort_values(ascending=False)
 
    else:
        raise ValueError(f"Unknown agg_rule: {agg_rule}")
    
    approval = df[parties].mean().to_dict()
    winner = pick_winner(ranked, seats, majority, approval)
    return ranked, winner

def aggregate_then_lift_weighted(df, parties, party_seats, majority,
                        agg_rule='borda', lift_rule='borda'):
    "first aggregating methods then lifting rules"

    coalitions = list(feasible_coalitions(parties, party_seats, majority))
    coalitions = [tuple(sorted(c)) for c in coalitions]
    coalitions = list(dict.fromkeys(coalitions))

    collective_ranking = get_collective_ranking_weighted(df, parties, weights, agg_rule)
    coalition_scores = {}
    for coalition in coalitions:
        if lift_rule == 'borda':
            n = len(collective_ranking)
            score = sum((n - 1 - collective_ranking.index(p))
                        for p in coalition if p in collective_ranking)
        elif lift_rule == 'max':
            pos = [collective_ranking.index(p) for p in coalition if p in collective_ranking]
            score = -min(pos) if pos else -999
        elif lift_rule == 'min':
            pos = [collective_ranking.index(p) for p in coalition if p in collective_ranking]
            score = -max(pos) if pos else -999
        elif lift_rule == 'approval':
            total_w = sum(weights)
            avg = {p: sum(row[p] * w for (_, row), w in zip(df.iterrows(), weights)) / total_w
                   for p in parties if p in df.columns}
            score = sum(avg.get(p, 0) for p in coalition)
        else:
            raise ValueError(f"Unknown lift_rule: {lift_rule}")
        if lift_rule in ('borda', 'approval'):
            coalition_scores[coalition] = score / len(coalition)
        else:
            coalition_scores[coalition] = score

    ranked = pd.Series(list(coalition_scores.values()), 
                       index=list(coalition_scores.keys())).sort_values(ascending=False)
    
    approval = df[parties].mean().to_dict()
    winner = pick_winner(ranked, party_seats, majority, approval)
    return ranked, winner
  
lift_rules = ['borda', 'max', 'min', 'approval']
agg_rules  = ['borda', 'copeland', 'stv']
atl_agg_rules = ['borda', 'approval', 'copeland', 'stv']
shared_agg_rules = ['borda', 'copeland', 'stv']


voted_norm = df_clean['GestemdePartij'].copy()
survey_counts = voted_norm.value_counts()
survey_share  = survey_counts / survey_counts.sum()

weights = compute_survey_weights(df_clean, voted_col='GestemdePartij',
                                 election_seats=LAST_ELECTION_SEATS)
weights_arr = weights.values
target_seats  = {p: LAST_ELECTION_SEATS.get(p, 0) for p in PARTIES}
target_sum    = sum(target_seats.values())
target_share  = {p: s / target_sum for p, s in target_seats.items()}
for party in PARTIES:
    survey_pct = survey_share.get(party, 0) * 100
    target_pct = target_share.get(party, 0) * 100
    w = weights[voted_norm == party].mean()
    print(f" {party:<25} survey={survey_pct:5.1f}%"
            f"target={target_pct:5.1f}%  weight={w:.3f}")

K = 3


borda_w  = get_borda_scores_weighted(df_clean, PARTIES, weights_arr)
copeland_w = get_copeland_scores_weighted(df_clean, PARTIES, weights_arr)
pav_w, _ = get_PAV_winner_weighted(df_clean, PARTIES, weights_arr, seats=K)
stv_w  = get_STV_ranking_weighted(df_clean, PARTIES, weights_arr)
print(f"Borda top {K} (weighted):  {list(borda_w.head(K).index)}")
print(f"Copeland top {K} (weighted): {list(copeland_w.head(K).index)}")
print(f"PAV top {K} (weighted): {pav_w}")
print(f"STV top {K} (weighted): {stv_w[:K]}")
 
lta_results_w = {}
for lift in lift_rules:
    for agg in agg_rules:
        lta_ranked, winner = lift_then_aggregate_weighted(df_clean, PARTIES, SURVEY_SEATS, MAJORITY, 
                                   lift_rule=lift, agg_rule=agg)
        lta_results_w[(lift, agg)] = list(winner) if winner else None
        seats_total = sum(SURVEY_SEATS.get(p, 0) for p in winner) if winner else 0
        print(f"Lift={lift:<10} Agg={agg:<12} → {list(winner) if winner else 'none'}"
              f"  ({seats_total} seats)")

atl_results_w = {}
for agg in atl_agg_rules:
    for lift in lift_rules:
        atl_ranked, winner = aggregate_then_lift_weighted(
            df_clean, PARTIES, SURVEY_SEATS, MAJORITY,
            agg_rule=agg, lift_rule=lift)
        atl_results_w[(agg, lift)] = list(winner) if winner else None
        seat_total = sum(SURVEY_SEATS.get(p, 0) for p in winner)
        n_tied = int((abs(atl_ranked - atl_ranked[winner]) < 1e-9).sum())
        note = f" [tie of {n_tied}]" if n_tied > 1 else ""
        print(f"Agg={agg:<10} Lift={lift:<12} → {list(winner)}  ({seat_total} seats){note}")
 
all_winners = [w for w in list(lta_results_w.values()) + list(atl_results_w.values()) if w]
 
winner_counts_w = Counter(tuple(sorted(w)) for w in all_winners)
print("\nHow often each coalition wins (weighted):")
total_methods = len(all_winners)
for coalition, count in winner_counts_w.most_common():
    print(f"{list(coalition)}: {count}/{total_methods} ({count/total_methods*100:.1f}%)")



def normalize_approval_scores(row, parties):
    "make scores normalized and sum up to 1"
    scores = {p: row[p] for p in parties if p in row.index}
    total_abs = sum(abs(v) for v in scores.values())
    if total_abs == 0:
        return {p: 0.0 for p in scores}
    return {p: v / total_abs for p, v in scores.items()}
 
 
def compute_aggregate_party_weights(df, parties):
    agg = {p: 0.0 for p in parties}
    for _, row in df.iterrows():
        normalized = normalize_approval_scores(row, parties)
        for p, w in normalized.items():
            agg[p] += w
    return pd.Series(agg).sort_values(ascending=False)
 
 
def form_coalition_greedy(party_weights, seats, majority):
    "continue until coalition is feasible"
    eligible = [(p, w) for p, w in party_weights.items()
                if w > 0 and p in seats]
    eligible.sort(key=lambda x: x[1], reverse=True)
 
    coalition = []
    total_seats = 0
 
    for party, _ in eligible:
        coalition.append(party)
        total_seats += seats.get(party, 0)
        if total_seats >= majority:
            break
 
    return coalition, {p: seats.get(p, 0) for p in coalition}, total_seats
 
 
def allocate_seats(coalition, weights, seats):
    "redistribute seats"
    position_weights = {p: max(weights[p], 0) for p in coalition}
    total_positions = sum(position_weights.values())
 
    if total_positions == 0:
        prop = {p: 1 / len(coalition) for p in coalition}
    else:
        prop = {p: position_weights[p] / total_positions for p in coalition}
 
    coalition_total_seats = sum(seats.get(p, 0) for p in coalition)

    raw = {p: prop[p] * coalition_total_seats for p in coalition}
    floors = {p: int(raw[p]) for p in coalition}
    remainders = {p: raw[p] - floors[p] for p in coalition}
    leftover = coalition_total_seats - sum(floors.values())
    sorted_by_remainder = sorted(remainders, key=remainders.get, reverse=True)
    allocated = floors.copy()
    for p in sorted_by_remainder[:leftover]:
        allocated[p] += 1
 
    return prop, allocated
 
 
def run_approval_coalition_weighted(df, parties, seats, survey_weights,
                                    majority, verbose=True):
    "form coalition greedily using approval scores "
    agg = {p: 0.0 for p in parties}
    for (_, row), sw in zip(df.iterrows(), survey_weights):
        normalized = normalize_approval_scores(row, parties)
        for p, nw in normalized.items():
            agg[p] += sw * nw
    party_weights_w = pd.Series(agg).sort_values(ascending=False)
 
    if verbose:
        print("\nAggregate weighted approval weights per party:")
        for party, w in party_weights_w.items():
            coalition_seats = seats.get(party, 0)
            sign = "+" if w >= 0 else "-"
            print(f" {party:<28} {sign}{abs(w):6.3f} ({coalition_seats} seats)")
 
    coalition, coalition_seat_dict, total_coalition_seats = form_coalition_greedy(
        party_weights_w, seats, majority
    )
 
    prop, allocated_seats = allocate_seats(
        coalition, party_weights_w, seats
    )
 
    if verbose:
        print(f"\nSeat allocation within coalition:")
        for p in coalition:
            actual = seats.get(p, 0)
            alloc = allocated_seats[p]
            share = prop[p] * 100
            print(f" {p:<28}  actual: {actual:2d} | "
                  f"approval-weighted: {alloc:2d} ({share:5.1f}%)")
 
    return {
        'party_weights':  party_weights_w,
        'coalition':  coalition,
        'coalition_seats':  coalition_seat_dict,
        'total_seats': total_coalition_seats,
        'approval_proportions': prop,
        'allocated_seats': allocated_seats,
    }

result_weighted = run_approval_coalition_weighted(
    df_clean, PARTIES, SURVEY_SEATS, weights_arr, MAJORITY
)
 
def collective_ranking_to_weights(collective_ranking, parties):
    n = len(parties)
    scores = {}
    for i, party in enumerate(collective_ranking):
        if party in parties:
            scores[party] = n - 1 - i
    return pd.Series(scores).sort_values(ascending=False)
 
 
def run_ranking_coalition(df, parties, seats, majority,
                          agg_rule, survey_weights=None):
    "form coalition greedily using rankings"
    if survey_weights is not None:
        collective_ranking = get_collective_ranking_weighted(
            df, parties, survey_weights, agg_rule
        )
    else:
        collective_ranking = get_collective_ranking_weighted(df, parties, agg_rule)
 
    party_weights = collective_ranking_to_weights(collective_ranking, parties)
 
    coalition, _, total_seats = form_coalition_greedy(
        party_weights, seats, majority
    )
 
    prop, allocated = allocate_seats(
        coalition, party_weights, seats
    )
 
    return {
        'agg_rule':           agg_rule,
        'collective_ranking': collective_ranking,
        'party_weights':      party_weights,
        'coalition':          coalition,
        'total_seats':        total_seats,
        'proportions':        prop,
        'allocated_seats':    allocated,
    }

results  = {}
 
for agg in atl_agg_rules:
    results[agg] = run_ranking_coalition(
        df_clean, PARTIES, SURVEY_SEATS, MAJORITY,
        agg_rule=agg, survey_weights=weights_arr
    )


 
for agg in atl_agg_rules:
    for outputs in [(results)]:
        r = outputs[agg]
        print(f" {agg:<12} {', '.join(r['coalition']):<45} {r['total_seats']}")

def method_of_equal_shares_weighted(
    df,
    parties: List[str],
    seats_dict: Dict[str, int],
    weights,
    majority: int,
    verbose: bool = True,
) -> Dict:
    "proportional mes"
    utilities = {}
    for party in parties:
        utilities[party] = {}
        for i in df.index:
            rating = df.loc[i, party]
            utilities[party][i] = max(0, rating)
    
    weights_aligned = weights.reset_index(drop=True)
    
    index_to_position = {i: pos for pos, i in enumerate(df.index)}
    
    total_weight = weights_aligned.sum()
    budget_per_weighted_vote = majority / total_weight
    voter_budgets = {i: weights_aligned[index_to_position[i]] * budget_per_weighted_vote 
                     for i in df.index}
    
    selected_parties = []
    total_cost = 0
    round_num = 1
    
    while total_cost < majority and len(selected_parties) < len(parties):
        best_party = None
        best_rho = float('inf')
        
        for party in parties:
            if party in selected_parties:
                continue
            
            party_cost = seats_dict[party]
            
            supporters = [i for i in df.index if utilities[party][i] > 0]
            
            if not supporters:
                continue
            
            total_supporter_budget = sum(voter_budgets[i] for i in supporters)
            
            if total_supporter_budget < party_cost:
                continue
            
            supporters_sorted = sorted(
                supporters,
                key=lambda i: voter_budgets[i] / utilities[party][i]
            )
            
            remaining_cost = party_cost
            remaining_utility = sum(utilities[party][i] for i in supporters)
            
            for supporter in supporters_sorted:
                if remaining_cost * utilities[party][supporter] <= voter_budgets[supporter] * remaining_utility:
                    break
                remaining_cost -= voter_budgets[supporter]
                remaining_utility -= utilities[party][supporter]
            
            rho = remaining_cost / remaining_utility if remaining_utility > 0 else float('inf')
            
            if rho < best_rho:
                best_rho = rho
                best_party = party
        
        if best_party is None:
            break
        
        selected_parties.append(best_party)
        party_cost = seats_dict[best_party]
        total_cost += party_cost
        
        
        supporters = [i for i in df.index if utilities[best_party][i] > 0]
        supporters_sorted = sorted(
            supporters,
            key=lambda i: voter_budgets[i] / utilities[best_party][i]
        )
        
        remaining_cost = party_cost
        remaining_utility = sum(utilities[best_party][i] for i in supporters)
        
        for supporter in supporters_sorted:
            if remaining_cost * utilities[best_party][supporter] <= voter_budgets[supporter] * remaining_utility:
                voter_budgets[supporter] -= best_rho * utilities[best_party][supporter]
                break
            else:
                remaining_cost -= voter_budgets[supporter]
                remaining_utility -= utilities[best_party][supporter]
                voter_budgets[supporter] = 0
        
        round_num += 1
        
        if total_cost >= majority:
            break
    
    total_utility_per_party = {
        party: sum(utilities[party][i] for i in df.index)
        for party in selected_parties
    }
    
    total_utilities = sum(total_utility_per_party.values())
    
    seat_allocation = {}
    proportions = {}
    for party in selected_parties:
        if total_utilities > 0:
            proportion = total_utility_per_party[party] / total_utilities
        else:
            proportion = 1 / len(selected_parties) if selected_parties else 0
        proportions[party] = proportion
        seat_allocation[party] = int(round(proportion * total_cost))
    
    return {
        'coalition': selected_parties,
        'coalition_seats': total_cost,
        'seat_allocation': seat_allocation,
        'proportions': proportions,
        'reached_majority': total_cost >= majority,
    }

mes_result = method_of_equal_shares_weighted(
    df_clean,
    PARTIES,
    SURVEY_SEATS,
    weights_for_seats,
    MAJORITY,
    verbose=True
)

print(f"\nMES Coalition: {mes_result['coalition']}")
print(f"Total seats: {mes_result['coalition_seats']}")
print(f"Reached majority: {mes_result['reached_majority']}")
print(f"\nSeat allocation:")
for party in mes_result['coalition']:
    allocated = mes_result['seat_allocation'][party]
    proportion = mes_result['proportions'][party] * 100
    print(f"  {party:<28} {allocated:2d} seats ({proportion:5.1f}%)")


def approval_welfare(df, coalition, parties, alloc_weights, survey_weights=None):
    members = [p for p in coalition if p in parties]
    if not members:
        return np.nan
    w = np.array([max(alloc_weights.get(p, 0), 0) for p in members], dtype=float)
    if w.sum() == 0:
        w = np.ones(len(members))
    w = w / w.sum()
    util = df[members].to_numpy(dtype=float) @ w
    if survey_weights is None:
        return float(util.mean())
    sw = np.asarray(survey_weights, dtype=float)
    return float(np.average(util, weights=sw))


lta_atl = {}
for (lift, agg), coal in lta_results_w.items():
    if coal: lta_atl.setdefault(tuple(sorted(coal)), []).append(f"LtA {lift}/{agg}")
for (agg, lift), coal in atl_results_w.items():
    if coal: lta_atl.setdefault(tuple(sorted(coal)), []).append(f"AtL {agg}/{lift}")

def wf(coal, alloc):
    return approval_welfare(df_clean, coal, PARTIES, alloc, survey_weights=weights_arr)

rows = []
for coal, labels in lta_atl.items():
    rows.append({'method': f"LtA/AtL (x{len(labels)})", 'coalition': list(coal),
                 'seats': sum(SURVEY_SEATS.get(p, 0) for p in coal),
                 'welfare_equal': wf(coal, {p: 1 for p in coal}),
                 'welfare_seats': wf(coal, SURVEY_SEATS),
                 'welfare_self':  np.nan})

def add_alloc(label, coal, allocation):
    rows.append({'method': label, 'coalition': list(coal),
                 'seats': sum(SURVEY_SEATS.get(p, 0) for p in coal),
                 'welfare_equal': wf(coal, {p: 1 for p in coal}),
                 'welfare_seats': wf(coal, SURVEY_SEATS),
                 'welfare_self':  wf(coal, allocation)})

add_alloc('Greedy approval', result_weighted['coalition'], result_weighted['allocated_seats'])
add_alloc('MES', mes_result['coalition'], mes_result['seat_allocation'])

welfare_table_w = (pd.DataFrame(rows)
                   .sort_values('welfare_seats', ascending=False)
                   .reset_index(drop=True))
print(welfare_table_w.to_string(index=False))