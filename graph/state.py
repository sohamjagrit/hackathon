from typing import Optional
from typing_extensions import TypedDict


class TripState(TypedDict, total=False):
    session_id: str
    last_query: str

    # Parsed trip intent
    origin: str           # IATA code, e.g. "MCO"
    destination: str      # IATA code, e.g. "CUN"
    depart_date: str      # YYYY-MM-DD
    return_date: str      # YYYY-MM-DD (if round-trip)
    nights: int
    pax: int

    # Search results (normalized, from sabre/client.py)
    flight_options: list
    hotel_options: list
    car_options: list

    # Confirmed selections
    selected_flight: Optional[dict]
    selected_hotel: Optional[dict]
    selected_car: Optional[dict]

    # Booking outcome
    pnr: Optional[str]
    transaction_id: Optional[str]
    total_usd: Optional[float]

    # Final speech (set at close node, fallback)
    speech: str
