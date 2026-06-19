import pandas as pd
import numpy as np
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
TOTAL_SEATS = 455
MAJORITY = TOTAL_SEATS // 2 + 1

df = pd.read_csv("survey_data_fr.csv")
df['ranking_list'] = df['Ranking'].apply(
    lambda x: [p.strip() for p in str(x).split('>')]
)
df = df.dropna(subset=['Ranking'])

df['passed_attention'] = df['V0'] == 'A'
df_clean = df[df['passed_attention']].copy()

n = len(df_clean)

# Extension rule (V0 = attention check)
extension = (df['V0'] == 'B').sum()
print(f"Extension violations (failed attention): {extension}/{len(df)} ({extension/len(df)*100:.1f}%)")

# Dominance  (V2): {1,2,3} vs {1,2} — B = violation
domi = (df_clean['V2'] == 'B').sum()
print(f"Dominance violations (V2): {domi}/{n} ({domi/n*100:.1f}%)")

# Indpendence (V3 vs V6): {1,3} vs {2} and {1,3,5} vs {2,5}
ind = (df_clean['V3'] != df_clean['V6']).sum()
print(f"IIA violations (V3 vs V6): {ind}/{n} ({ind/n*100:.1f}%)")

# Independence with higher ranked party (V4 vs V5): {1,8} vs {4,5} and {1,3,8} vs {3,4,5}
ind_higher = (df_clean['V4'] != df_clean['V5']).sum()
print(f"Separability violations (V4 vs V5): {ind_higher}/{n} ({ind_higher/n*100:.1f}%)")

# Size vs Quality (V1)
v1 = df_clean['V1'].value_counts()
print(f"Size vs Quality (V1): {v1.to_dict()} A=prefer single best party")

# Independence of worst alternative (V4)
worst = (df_clean['V4'] == 'B').sum()
print(f"Chose neutral over top+worst (V4): {worst}/{n} ({worst/n*100:.1f}%)")

# Balance vs Dominance (V8)
balance = (df_clean['V8'] == 'B').sum()
print(f"Chose balance over dominance (V8): {balance}/{n} ({balance/n*100:.1f}%)")

# Threshold acceptability (V9)
accept = (df_clean['V9'] == 'A').sum()
print(f"Accept c at 30% power (V9): {accept}/{n} ({accept/n*100:.1f}%)")


def utilitarian(df, rank_weights):
    total, valid = 0, 0
    for _, row in df.iterrows():
        ranking = row['ranking_list']
        score = sum(row[ranking[r]] * w
            for r, w in rank_weights.items()
            if ranking[r] in PARTIES)
        total += score; valid += 1
    return total / valid if valid > 0 else 0

# V7: {1:20%, 3:80%} vs {1:60%, 6:40%}
print("\n--- V7: {1:20%, 3:80%} vs {1:60%, 6:40%} ---")
uA7 = utilitarian(df_clean, {0:0.2, 2:0.8})
uB7 = utilitarian(df_clean, {0:0.6, 5:0.4})

majority_vote_7 = 'A' if (df_clean['V7']=='A').sum() > (df_clean['V7']=='B').sum() else 'B'
print(f"Majority: {majority_vote_7}")
print(f"Utilitarian: A={uA7:.2f} B={uB7:.2f}, {'A' if uA7>uB7 else 'B'}")

# V8: {1:90%, 2:10%} vs {1:50%, 2:50%}
print("\n--- V8: {1:90%, 2:10%} vs {1:50%, 2:50%} ---")
uA8 = utilitarian(df_clean, {0:0.9, 1:0.1})
uB8 = utilitarian(df_clean, {0:0.5, 1:0.5})
majority_vote_8 = 'A' if (df_clean['V8']=='A').sum() > (df_clean['V8']=='B').sum() else 'B'
print(f"Majority: {majority_vote_8} ({'dominance' if majority_vote_8=='A' else 'balance'})")
print(f"Utilitarian: A={uA8:.2f} B={uB8:.2f}, {'A (dominance)' if uA8>uB8 else 'B (balance)'}")

# V9: {1:70%, c:30%} vs {2:50%, 3:50%}
print("\n--- V9: {1:70%, c:30%} vs {2:50%, 3:50%} ---")
uA9, uB9, valid9 = 0, 0, 0
for _, row in df_clean.iterrows():
    rl = row['ranking_list']
    c  = row['C_partij']
    if all(p in PARTIES for p in [rl[0], rl[1], rl[2], c]):
        score_a = row[rl[0]]*0.7 + row[c]*0.3
        score_b = row[rl[1]]*0.5 + row[rl[2]]*0.5
        uA9 += score_a; uB9 += score_b
        valid9 += 1
uA9 = uA9/valid9 if valid9 > 0 else 0
uB9 = uB9/valid9 if valid9 > 0 else 0

majority_vote_9 = 'A' if (df_clean['V9']=='A').sum() > (df_clean['V9']=='B').sum() else 'B'
print(f"Majority: {majority_vote_9}")
print(f"Utilitarian: A={uA9:.2f} B={uB9:.2f}, {'A' if uA9>uB9 else 'B'}")

def get_survey_derived_seats(df, parties, total_seats=TOTAL_SEATS, verbose=False):

    "based on the first ranked-parties get the seats from the survey"

    first_choices = df['ranking_list'].apply(lambda x: x[0] if x else None)
    party_counts = first_choices.value_counts()
    total_votes = len(df)
    
    seats_dict = {}
    for party in parties:
        votes = party_counts.get(party, 0)
        raw_seats = (votes / total_votes) * total_seats
        seats_dict[party] = round(raw_seats)
    
    for party in parties:
        if seats_dict.get(party, 0) <= 0:
            seats_dict[party] = 1
    
    current_total = sum(seats_dict.values())
    
    if current_total != total_seats:
        diff = total_seats - current_total
        sorted_parties = sorted(parties, key=lambda p: party_counts.get(p, 0), reverse=True)
        
        for i in range(abs(diff)):
            party = sorted_parties[i % len(sorted_parties)]
            if diff > 0:
                seats_dict[party] += 1

            else:
                if seats_dict[party] > 1:
                    seats_dict[party] -= 1
    
    if verbose:
        print(f"\nFinal seat allocation: {sum(seats_dict.values())} total")
        for party in sorted(parties, key=lambda p: seats_dict[p], reverse=True):
            print(f"  {party:<24} {seats_dict[party]:>3} seats")
        print(f"  {'TOTAL':<24} {sum(seats_dict.values()):>3} seats")
    
    return seats_dict
 
SURVEY_SEATS = get_survey_derived_seats(df_clean, PARTIES, total_seats=TOTAL_SEATS, verbose=True)

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

def feasible_coalitions(parties_list, seats_dict, majority):
    result = []
    for size in range(2, len(parties_list) + 1):
        for coalition in combinations(parties_list, size):
            score = sum(seats_dict[p] for p in coalition)
            if score >= majority:
                result.append((coalition, score))
    return result

all_feasible_coalitions = feasible_coalitions(PARTIES, SURVEY_SEATS, MAJORITY)

print(f"\nTotal feasible coalitions: {len(all_feasible_coalitions)}")


def get_borda_scores(df, parties):
    n = len(parties)
    scores = {p: 0 for p in parties}
    for ranking in df['ranking_list']:
        for i, party in enumerate(ranking):
            if party in scores:
                scores[party] += (n - 1 - i)
    return pd.Series(scores).sort_values(ascending=False)

def get_copeland_scores(df, parties):
    wins = {p: 0 for p in parties}
    for i, party_1 in enumerate(parties):
        for party_2 in parties[i+1:]:
            party_1_won = sum(
                1 for ranking in df['ranking_list']
                if ranking.index(party_1) < ranking.index(party_2)
            )
            party_2_won = len(df) - party_1_won
            if party_1_won > party_2_won: wins[party_1] += 1
            elif party_2_won > party_2_won: wins[party_2] += 1
    return pd.Series(wins).sort_values(ascending=False)

def get_PAV_winner(df, parties, seats=3):
    best_score, best_coalition = -1, None
    for coalition in combinations(parties, seats):
        score = sum(
            sum(1/(j+1) for j in range(sum(1 for p in coalition if row[p] > 0)))
            for _, row in df.iterrows()
        )
        if score > best_score:
            best_score, best_coalition = score, coalition
    return list(best_coalition), best_score

def get_STV_winner(df, parties, seats=3):
    n = len(df)
    droop_quota = int(n / (seats + 1)) + 1
    remaining_parties, elected_parties = parties.copy(), []
    ballots = [{'prefs': [p for p in row['ranking_list'] if p in parties],
                'weight': 1.0}
               for _, row in df.iterrows()]
    round_number = 0
    while len(elected_parties) < seats and remaining_parties:
        round_number += 1
        vote_counts = {p: 0.0 for p in remaining_parties}
        for ballot in ballots:
            for party in ballot['prefs']:
                if party in remaining_parties:
                    vote_counts[party] += ballot['weight']
                    break
        winners_this_round = [p for p, v in vote_counts.items() if v >= droop_quota]
        if winners_this_round:
            for winner in winners_this_round:
                elected_parties.append(winner)
                remaining_parties.remove(winner)
                surplus = vote_counts[winner] - droop_quota
                if surplus > 0:
                    ratio = surplus / vote_counts[winner]
                    for ballot in ballots:
                        if ballot['prefs'] and ballot['prefs'][0] == winner:
                            ballot['weight'] *= ratio
                for ballot in ballots:
                    ballot['prefs'] = [p for p in ballot['prefs'] if p != winner]
        else:
            if not vote_counts: break
            last_candidate = min(vote_counts, key=vote_counts.get)
            still_needed = seats - len(elected_parties)
            if len(remaining_parties) - 1 < still_needed:
                elected_parties.extend(remaining_parties)
                remaining_parties = []
                break
            remaining_parties.remove(last_candidate)
            for ballot in ballots:
                ballot['prefs'] = [p for p in ballot['prefs'] if p != last_candidate]
        still_needed = seats - len(elected_parties)
        if len(remaining_parties) == still_needed:
            elected_parties.extend(remaining_parties)
            remaining_parties = []
            break
    return elected_parties

def get_STV_ranking(df, parties):
    remaining_parties = parties.copy()
    elimination_order = []
    ballots = [{'prefs': [p for p in row['ranking_list'] if p in parties],
                'weight': 1.0}
               for _, row in df.iterrows()]
    while remaining_parties:
        vote_counts = {p: 0.0 for p in remaining_parties}
        for ballot in ballots:
            for party in ballot['prefs']:
                if party in remaining_parties:
                    vote_counts[party] += ballot['weight']
                    break
        if len(remaining_parties) == 1:
            elimination_order.append(remaining_parties[0])
            remaining_parties = []
            break
        last_candidate = min(vote_counts, key=vote_counts.get)
        elimination_order.append(last_candidate)
        remaining_parties.remove(last_candidate)
        for ballot in ballots:
            ballot['prefs'] = [p for p in ballot['prefs'] if p != last_candidate]
    return list(reversed(elimination_order))

K = 3

borda    = get_borda_scores(df_clean, PARTIES)
copeland = get_copeland_scores(df_clean, PARTIES)
pav, _   = get_PAV_winner(df_clean, PARTIES, seats=K)
stv      = get_STV_winner(df_clean, PARTIES, seats=K)
print(f"Borda top {K}:              {list(borda.head(K).index)}")
print(f"Copeland top {K}:           {list(copeland.head(K).index)}")
print(f"PAV top {K}:                {pav}")
print(f"STV top {K}:                {stv}")


print("\n--- Majority preference per dual question ---")
dual_questions = {
    'V0': ('{1,2}',   '{3,4}'),
    'V1': ('{1}',     '{2,3,4}'),
    'V2': ('{1,2,3}', '{1,2}'),
    'V3': ('{1,3}',   '{2}'),
    'V4': ('{1,8}',   '{4,5}'),
    'V5': ('{1,3,8}', '{3,4,5}'),
    'V6': ('{1,3,5}', '{2,4,5}'),
}
for column, (a, b) in dual_questions.items():
    counts = df_clean[column].value_counts()
    winner = counts.idxmax()
    percentage = counts[winner] / len(df_clean) * 100
    print(f"{column}: majority picks {a if winner=='A' else b} ({percentage:.1f}%)")

def borda_lift(coalition, ranking, n=8):
    return sum((n-1-ranking.index(p)) for p in coalition if p in ranking)

def max_lift(coalition, ranking):
    positions = [ranking.index(p) for p in coalition if p in ranking]
    return -min(positions) if positions else -999

def min_lift(coalition, ranking):
    positions = [ranking.index(p) for p in coalition if p in ranking]
    return -max(positions) if positions else -999

def approval_lift(coalition, approval_row):
    return sum(approval_row.get(p, 0) for p in coalition)

def get_collective_ranking(df, parties, agg_rule):
    "form collective ranking using only the voting rules"
    if agg_rule == 'borda':
        n = len(parties)
        scores = {p: 0 for p in parties}
        for ranking in df['ranking_list']:
            for i, party in enumerate(ranking):
                if party in scores:
                    scores[party] += (n-1-i)
        return sorted(scores, key=scores.get, reverse=True)
    elif agg_rule == 'plurality':
        first = df['ranking_list'].apply(lambda x: x[0] if x else None)
        return list(first.value_counts().index)
    elif agg_rule == 'approval':
        return list(df[parties].mean().sort_values(ascending=False).index)
    elif agg_rule == 'copeland':
        return list(get_copeland_scores(df, parties).index)
    elif agg_rule == 'stv':
        return get_STV_ranking(df, parties)
    else:
        raise ValueError(f"Unknown agg_rule: {agg_rule}")

def lift_individual(row, coalition, parties, lift_rule):
    "only lifting"
    ranking = row['ranking_list']
    if lift_rule == 'borda':
        return sum((len(parties) - 1 - ranking.index(p))
                   for p in coalition if p in ranking)
    elif lift_rule == 'max':
        pos = [ranking.index(p) for p in coalition if p in ranking]
        return -min(pos) if pos else -999
    elif lift_rule == 'min':
        pos = [ranking.index(p) for p in coalition if p in ranking]
        return -max(pos) if pos else -999
    elif lift_rule == 'approval':
        return sum(row[p] for p in coalition if p in row.index)
    else:
        raise ValueError(f"Unknown lift_rule: {lift_rule}")

def lift_then_aggregate(df, parties, seats, majority,
                        lift_rule='borda', agg_rule='borda'):
    "first lifting then aggregating"
    feasible = feasible_coalitions(parties, seats, majority)
    coalitions = [c for c, s in feasible]
    coalitions = [tuple(sorted(c)) for c in coalitions]
    coalitions = list(dict.fromkeys(coalitions))

    row_scores = []
    for _, row in df.iterrows():
        if lift_rule in ('borda', 'approval'):
            scores = {c: lift_individual(row, c, parties, lift_rule) / len(c)
                  for c in coalitions}
        else:
            scores = {c: lift_individual(row, c, parties, lift_rule)
                  for c in coalitions}
        row_scores.append(scores)

    row_rankings = [
        sorted(scores, key=lambda c: (-scores[c], len(c), c))
        for scores in row_scores
    ]

    if agg_rule == 'borda':
        n_coal = len(coalitions)
        totals = {c: 0.0 for c in coalitions}
        for ranking in row_rankings:
            for position, c in enumerate(ranking):
                totals[c] += (n_coal - 1 - position)
        ranked = pd.Series(list(totals.values()), index=list(totals.keys())).sort_values(ascending=False)

    elif agg_rule == 'copeland':
        wins = {c: 0.0 for c in coalitions}
        for i, coalition_1 in enumerate(coalitions):
            for coalition_2 in coalitions[i+1:]:
                c1_wins = sum(
                    1 for ranking in row_rankings
                    if ranking.index(coalition_1) < ranking.index(coalition_2)
                )
                c2_wins = len(row_rankings) - c1_wins
                if c1_wins > c2_wins:
                    wins[coalition_1] += 1
                elif c2_wins > c1_wins:
                    wins[coalition_2] += 1
        ranked = pd.Series(list(wins.values()), index=list(wins.keys())).sort_values(ascending=False)

    elif agg_rule == 'stv':
        remaining_parties = coalitions.copy()
        elimination_order = []
        ballots = [{'prefs': list(r)} for r in row_rankings]
        while remaining_parties:
            vote_counts = {c: 0 for c in remaining_parties}
            for ballot in ballots:
                for c in ballot['prefs']:
                    if c in remaining_parties:
                        vote_counts[c] += 1
                        break
            if len(remaining_parties) == 1:
                elimination_order.append(remaining_parties[0])
                break
            last_candidate = min(vote_counts, key=vote_counts.get)
            elimination_order.append(last_candidate)
            remaining_parties.remove(last_candidate)
            for ballot in ballots:
                ballot['prefs'] = [c for c in ballot['prefs'] if c != last_candidate]
        ranked_list = list(reversed(elimination_order))
        stv_scores = {c: len(ranked_list) - 1 - i for i, c in enumerate(ranked_list)}
        ranked = pd.Series(list(stv_scores.values()), index=list(stv_scores.keys())).sort_values(ascending=False)

    else:
        raise ValueError(f"Unknown agg_rule: {agg_rule}")

    approval = df[parties].mean().to_dict()
    winner = pick_winner(ranked, seats, majority, approval)
    return ranked, winner

def aggregate_then_lift(df, parties, seats, majority,
                        agg_rule='borda', lift_rule='borda'):
    "first aggregating methods then lifting rules"
    feasible = feasible_coalitions(parties, seats, majority)
    coalitions = [c for c, s in feasible]
    coalitions = [tuple(sorted(c)) for c in coalitions]
    coalitions = list(dict.fromkeys(coalitions))
    
    collective_ranking = get_collective_ranking(df, parties, agg_rule)
    coalition_scores = {}
    for coalition in coalitions:
        if lift_rule == 'borda':
            score = borda_lift(coalition, collective_ranking)
        elif lift_rule == 'max':
            score = max_lift(coalition, collective_ranking)
        elif lift_rule == 'min':
            score = min_lift(coalition, collective_ranking)
        elif lift_rule == 'approval':
            avg_approval = df[parties].mean().to_dict()
            score = approval_lift(coalition, avg_approval)
        else:
            raise ValueError(f"Unknown lift_rule: {lift_rule}")
        
        if lift_rule in ('borda', 'approval'):
            coalition_scores[coalition] = score / len(coalition)
        else:
            coalition_scores[coalition] = score
            
    
    ranked = pd.Series(list(coalition_scores.values()), 
                       index=list(coalition_scores.keys())).sort_values(ascending=False)
    
    approval = df[parties].mean().to_dict()
    winner = pick_winner(ranked, seats, majority, approval)
    return ranked, winner

lta_agg_rules = ['borda', 'copeland', 'stv']
atl_agg_rules = ['borda', 'approval', 'copeland', 'stv']
shared_agg_rules = ['borda', 'copeland', 'stv']
lift_rules   = ['borda', 'max', 'min', 'approval']

print("\n--- Lift then Aggregate ---")
lta_results = {}
for lift in lift_rules:
    for agg in lta_agg_rules:
        lta_ranked, winner = lift_then_aggregate(df_clean, PARTIES, SURVEY_SEATS, MAJORITY, 
                                   lift_rule=lift, agg_rule=agg)
        lta_results[(lift, agg)] = list(winner) if winner else None
        seats = sum(SURVEY_SEATS.get(p, 0) for p in winner) if winner else 0
        print(f"Lift={lift:<10} Agg={agg:<12} → {list(winner) if winner else 'none'}"
              f"  ({seats} seats)")

print("\n--- Aggregate then Lift ---")
atl_results = {}
for agg in atl_agg_rules:
    for lift in lift_rules:
        atl_ranked, winner = aggregate_then_lift(
            df_clean, PARTIES, SURVEY_SEATS, MAJORITY,
            agg_rule=agg, lift_rule=lift)
        atl_results[(agg, lift)] = list(winner) if winner else None
        seat_total = sum(SURVEY_SEATS.get(p, 0) for p in winner)
        n_tied = int((abs(atl_ranked - atl_ranked[winner]) < 1e-9).sum())
        note = f"   [tie of {n_tied}]" if n_tied > 1 else ""
        print(f"Agg={agg:<10} Lift={lift:<12} → {list(winner)}  ({seat_total} seats){note}")

all_winners = [w for w in list(lta_results.values()) + list(atl_results.values()) if w]
winner_counts = Counter(tuple(sorted(w)) for w in all_winners)
print("\nHow often each coalition wins:")
total_methods = len(lta_results) + len(atl_results)
for coalition, count in winner_counts.most_common():
    seats = sum(SURVEY_SEATS.get(p, 0) for p in coalition)
    print(f"  {list(coalition)}: {count}/{total_methods} ({count/total_methods*100:.1f}%)  —  {seats} seats")


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
 
 
def allocate_seats(coalition, party_weights, seats):
    "redistribute seats"
    pos_weights = {p: max(party_weights[p], 0) for p in coalition}
    total_pos = sum(pos_weights.values())
 
    if total_pos == 0:
        prop = {p: 1 / len(coalition) for p in coalition}
    else:
        prop = {p: pos_weights[p] / total_pos for p in coalition}

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
 
 
def run_approval_coalition_analysis(df, parties, seats, majority,
                                    verbose=True):
    "form coalition greedily using approval scores "
    party_weights = compute_aggregate_party_weights(df, parties)
 
    if verbose:
        print("\nAggregate normalized approval weights per party:")
        for party, w in party_weights.items():
            coalition_seats = seats.get(party, 0)
            sign = "+" if w >= 0 else "-"
            print(f"  {party:<28} {sign}{abs(w):6.3f}  ({coalition_seats} seats)")

    coalition, coalition_seat_dict, total_coalition_seats = form_coalition_greedy(
        party_weights, seats, majority
    )
 
    prop, allocated_seats = allocate_seats(
        coalition, party_weights, seats
    )
 
    if verbose:
        print(f"\nSeat allocation within coalition "
              f"(proportional to approval weights, {total_coalition_seats} total seats):")
        for p in coalition:
            actual   = seats.get(p, 0)
            alloc    = allocated_seats[p]
            share    = prop[p] * 100
            print(f"  {p:<28}  actual parliament seats: {actual:2d} | "
                  f"approval-weighted allocation: {alloc:2d} ({share:5.1f}%)")
 
    return {
        'party_weights':        party_weights,
        'coalition':            coalition,
        'coalition_seats':      coalition_seat_dict,
        'total_seats':          total_coalition_seats,
        'approval_proportions': prop,
        'allocated_seats':      allocated_seats,
    }

result = run_approval_coalition_analysis(
    df_clean, PARTIES, SURVEY_SEATS, MAJORITY
)

def collective_ranking_to_weights(collective_ranking, parties):
    n = len(parties)
    scores = {}
    for i, party in enumerate(collective_ranking):
        if party in parties:
            scores[party] = n - 1 - i
    return pd.Series(scores).sort_values(ascending=False)


def run_ranking_coalition(df, parties, seats, majority,
                          agg_rule):
    "form coalition greedily using rankings"
    collective_ranking = get_collective_ranking(df, parties, agg_rule)

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

results = {}

for agg in atl_agg_rules:
    results[agg] = run_ranking_coalition(
        df_clean, PARTIES, SURVEY_SEATS, MAJORITY,
        agg_rule=agg
    )

print(f"  {'Agg rule':<12} {'Weighting':<12} {'Coalition':<45} {'Seats'}")

for agg in atl_agg_rules:
    r = results[agg]
    print(f"  {agg:<12} {', '.join(r['coalition']):<45} {r['total_seats']}")

def load_ideal_coalitions(df):
    "load the inputs ideal coalitions"
    ideal_allocations = []
    for val in df['IdealCoalition'].dropna():
        try:
            p_raw = json.loads(val)
            if not p_raw: continue
            p_total = sum(p_raw.values())
            if p_total == 0: continue
            p = {k: float(v)/p_total for k, v in p_raw.items()}
            ideal_allocations.append(p)
        except: continue
    print(f"Valid ideal coalitions: {len(ideal_allocations)}")
    return ideal_allocations

def l1_welfare(candidate_q, ideal_allocations, parties):
    total = 0
    for p in ideal_allocations:
        total -= sum(abs(p.get(party, 0) - candidate_q.get(party, 0))
                     for party in parties)
    return total / len(ideal_allocations) if ideal_allocations else 0


def l1_optimal_direct(df, parties):
    party_values = {p: [] for p in parties}
    n_total = 0
    for val in df['IdealCoalition'].dropna():
        try:
            p_raw = json.loads(val)
            if not p_raw: continue
            p_total = sum(p_raw.values())
            for party, pct in p_raw.items():
                if party in party_values:
                    party_values[party].append(float(pct)/p_total)
            n_total += 1
        except: continue
    medians = {}
    for party in parties:
        values = party_values[party]
        zeros = [0.0] * (n_total - len(values))
        medians[party] = float(np.median(values + zeros))
    total = sum(medians.values())
    if total > 0:
        medians = {p: v/total for p, v in medians.items()}
        print(medians)
    result = pd.Series({p: v for p, v in medians.items() if v > 0.001})
    return result.sort_values(ascending=False)

ideal_allocations = load_ideal_coalitions(df_clean)

print("\n--- L1 Welfare (closed-form median) ---")
l1_result = l1_optimal_direct(df_clean, PARTIES)
print("Optimal allocation (coordinate-wise median):")
for p, v in l1_result.items():
    print(f"{p}: {v*100:.1f}%")
candidate_q = l1_result.to_dict()
w = l1_welfare(candidate_q, ideal_allocations, PARTIES)
print(f"L1 welfare of the L1-optimal allocation: {w:.4f}")



def method_of_equal_shares_coalitions(
    df,
    parties: List[str],
    seats_dict: Dict[str, int],
    majority: int,
) -> Dict:
    "proportional mes"
    utilities = {}
    for party in parties:
        utilities[party] = {}
        for i in df.index:
            rating = df.loc[i, party]
            utilities[party][df.index.get_loc(i)] = max(0, rating)
    
    n_voters = len(df)
    budget_per_voter = majority / n_voters
    voter_budgets = {i: budget_per_voter for i in range(n_voters)}
    
    selected_parties = []
    total_cost = 0
    
    round_num = 1

    while total_cost < majority:
        best_party = None
        best_rho = float('inf')
        
        for party in parties:
            if party in selected_parties:
                continue
            
            party_cost = seats_dict[party]
            supporters = [i for i in range(n_voters) if utilities[party][i] > 0]
            
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
        
        supporters = [i for i in range(n_voters) if utilities[best_party][i] > 0]
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
        party: sum(max(0, utilities[party][i]) for i in range(n_voters))
        for party in selected_parties
    }
    
    total_utilities = sum(total_utility_per_party.values())
    
    seat_allocation = {}
    proportions = {}
    for party in selected_parties:
        if total_utilities > 0:
            proportion = total_utility_per_party[party] / total_utilities
        else:
            proportion = 1 / len(selected_parties)
        proportions[party] = proportion
        seat_allocation[party] = int(round(proportion * total_cost))
    
    return {
        'coalition': selected_parties,
        'coalition_seats': total_cost,
        'seat_allocation': seat_allocation,
        'proportions': proportions,
    }


print("\n--- Method of Equal Shares ---")
mes_result = method_of_equal_shares_coalitions(
    df_clean,
    PARTIES,
    SURVEY_SEATS,
    MAJORITY
)

print(f"\nMES Coalition: {mes_result['coalition']}")
print(f"Total seats: {mes_result['coalition_seats']}")
print(f"\nSeat allocation:")
for party in mes_result['coalition']:
    actual = SURVEY_SEATS.get(party, 0)
    allocated = mes_result['seat_allocation'][party]
    proportion = mes_result['proportions'][party] * 100
    print(f"  {party:<28} actual: {actual:2d} | allocated: {allocated:2d} ({proportion:5.1f}%)")


def approval_welfare(df, coalition, parties, weights):
    members = [p for p in coalition if p in parties]
    if not members:
        return np.nan
    w = np.array([max(weights.get(p, 0), 0) for p in members], dtype=float)
    if w.sum() == 0:
        w = np.ones(len(members))
    w = w / w.sum()
    util = df[members].to_numpy(dtype=float) @ w
    return float(util.mean())

lta_atl = {}
for (lift, agg), coal in lta_results.items():
    if coal:
        lta_atl.setdefault(tuple(sorted(coal)), []).append(f"LtA {lift}/{agg}")
for (agg, lift), coal in atl_results.items():
    if coal:
        lta_atl.setdefault(tuple(sorted(coal)), []).append(f"AtL {agg}/{lift}")

rows = []
for coal, labels in lta_atl.items():
    rows.append({
        'method': f"LtA/AtL (x{len(labels)})",
        'coalition': list(coal),
        'seats':  sum(SURVEY_SEATS.get(p, 0) for p in coal),
        'welfare_equal': approval_welfare(df_clean, coal, PARTIES, {p: 1 for p in coal}),
        'welfare_seats': approval_welfare(df_clean, coal, PARTIES, SURVEY_SEATS),
        'welfare_self':  np.nan,
    })

def add_alloc(label, coal, allocation):
    rows.append({
        'method':  label,
        'coalition': list(coal),
        'seats': sum(SURVEY_SEATS.get(p, 0) for p in coal),
        'welfare_equal': approval_welfare(df_clean, coal, PARTIES, {p: 1 for p in coal}),
        'welfare_seats': approval_welfare(df_clean, coal, PARTIES, SURVEY_SEATS),
        'welfare_self': approval_welfare(df_clean, coal, PARTIES, allocation),
    })

add_alloc('Greedy approval', result['coalition'], result['allocated_seats'])
add_alloc('MES', mes_result['coalition'], mes_result['seat_allocation'])
add_alloc('L1-median', list(l1_result.index), l1_result.to_dict())

welfare_table = (pd.DataFrame(rows)
                 .sort_values('welfare_seats', ascending=False)
                 .reset_index(drop=True))
print(welfare_table.to_string(index=False))