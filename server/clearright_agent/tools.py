import logging
from google.adk.tools import google_search


def search_legal_information(query: str, state: str = "") -> str:
    """
    Search for legal information, statutes, tenant rights, consumer protections,
    and legal aid resources. Use this for state-specific laws and current regulations.

    Args:
        query: The legal topic or question to search for
        state: Optional US state name to scope the search (e.g., "California", "Texas")

    Returns:
        Relevant legal information from authoritative sources
    """
    search_query = query
    if state:
        search_query = f"{query} {state} law statute rights"
    else:
        search_query = f"{query} US law rights legal information"

    logging.info(f"Legal search: {search_query}")
    return google_search(search_query)


def get_legal_aid_resources(state: str, issue_type: str = "") -> str:
    """
    Find free legal aid organizations and resources for a given US state.

    Args:
        state: US state name
        issue_type: Type of legal issue (eviction, debt, employment, etc.)

    Returns:
        List of legal aid resources and contact information
    """
    query = f"free legal aid {state}"
    if issue_type:
        query = f"free legal aid {issue_type} {state} organization contact"
    else:
        query = f"free legal aid {state} organization contact phone"

    logging.info(f"Legal aid resource search: {query}")
    return google_search(query)
